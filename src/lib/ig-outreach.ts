// ig-outreach.ts — منطق خالص لقائمة تواصل Colapia مع البراندات (/admin/outreach): قراءة الحسابات من الروابط،
// والجدول اليومي المحدود (رسائل متباعدة داخل نافذة ساعات بتوقيت القاهرة)، وفحص الرسالة الافتتاحية قبل حفظها.
import { cairoDate, cairoWallTime, nextCairoDay } from "@/lib/cairo-time";

export const LEAD_STATUSES = ["queued", "ready", "sent", "replied", "owner", "form", "won", "declined", "skipped"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_INFO: Record<LeadStatus, { label: string; tone: "muted" | "info" | "warn" | "ok" | "bad" }> = {
  queued: { label: "في الطابور", tone: "muted" },
  ready: { label: "جاهزة للإرسال", tone: "info" },
  sent: { label: "أُرسلت", tone: "info" },
  replied: { label: "ردّوا", tone: "warn" },
  owner: { label: "صاحب البراند", tone: "warn" },
  form: { label: "أرسل الفورم", tone: "ok" },
  won: { label: "دفع", tone: "ok" },
  declined: { label: "رفض", tone: "bad" },
  skipped: { label: "تخطّيته", tone: "muted" },
};

/** الحالات التي تنتظر إرسالاً (تدخل الجدول اليومي). */
export const PENDING_STATUSES: LeadStatus[] = ["queued", "ready"];

const RESERVED = new Set(["p", "reel", "reels", "stories", "explore", "accounts", "direct", "tv", "about", "developer", "legal"]);

/** اسم الحساب من رابط إنستجرام أو @اسم أو الاسم نفسه. null إن لم يكن اسماً صالحاً. */
export function handleFrom(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  const url = /^(?:https?:\/\/)?(?:www\.|m\.)?(?:instagram\.com|instagr\.am)\/([^/?#\s]+)/i.exec(s);
  if (url) s = url[1]!;
  else if (/^https?:\/\//i.test(s) || /\.(com|net|org|eg)\b/i.test(s)) return null;
  s = s.replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(s) || s.startsWith(".") || s.endsWith(".") || RESERVED.has(s)) return null;
  return s;
}

export type ParsedLead = { handle: string; note: string | null };

/**
 * يقرأ ما يلصقه المالك: حساب في كل سطر، وملاحظة اختيارية بعد «|» أو «-» أو مسافة (مثل:
 * `https://instagram.com/brand | فساتين سواريه وتصويرها حلو`). يحذف المكرر ويعيد الأسطر غير المفهومة.
 */
export function parseLeadLines(text: string): { leads: ParsedLead[]; invalid: string[] } {
  const leads: ParsedLead[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const m = /^(\S+)\s*(?:[|｜\-–—:]\s*)?(.*)$/.exec(t);
    const handle = m ? handleFrom(m[1]!) : null;
    if (!handle) {
      invalid.push(t.slice(0, 80));
      continue;
    }
    if (seen.has(handle)) continue;
    seen.add(handle);
    const note = (m?.[2] ?? "").trim().slice(0, 300);
    leads.push({ handle, note: note || null });
  }
  return { leads, invalid };
}

export type OutreachSettings = { dailyCap: number; startHour: number; endHour: number };
export const DEFAULT_OUTREACH: OutreachSettings = { dailyCap: 18, startHour: 11, endHour: 22 };

/** إعداد «outreach» من لوحة المالك بحدود آمنة (حد يومي 1–30، نافذة ساعتين على الأقل). */
export function outreachSettingsFrom(config: unknown): OutreachSettings {
  const c = (config && typeof config === "object" ? config : {}) as Record<string, unknown>;
  const int = (v: unknown, min: number, max: number, d: number) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= min && n <= max ? n : d;
  };
  const startHour = int(c.startHour, 0, 22, DEFAULT_OUTREACH.startHour);
  let endHour = int(c.endHour, 1, 24, DEFAULT_OUTREACH.endHour);
  if (endHour - startHour < 2) endHour = Math.min(24, startHour + 2);
  return { dailyCap: int(c.dailyCap, 1, 30, DEFAULT_OUTREACH.dailyCap), startHour, endHour };
}

/** مواعيد يوم واحد: `cap` موعداً موزعة بالتساوي داخل النافذة، ومزاحة قليلاً حتى لا تبدو آلية (حتمية من اليوم). */
export function daySlots(day: { y: number; m: number; d: number }, s: OutreachSettings): Date[] {
  const start = s.startHour * 60;
  const span = (s.endHour - s.startHour) * 60;
  const step = span / s.dailyCap;
  const out: Date[] = [];
  for (let i = 0; i < s.dailyCap; i++) {
    const jitter = ((day.d * 37 + i * 53) % 11) - 5; // −5..+5 دقائق
    const minute = Math.round(start + step * i + step / 2 + Math.max(-step / 3, Math.min(step / 3, jitter)));
    out.push(cairoWallTime(day, minute));
  }
  return out;
}

/**
 * أقرب `count` مواعيد فارغة بعد `now` (بهامش 5 دقائق)، مع احترام الحد اليومي: كل يوم يُحسب ما حُجز فيه أو أُرسل.
 * `taken` = مواعيد محجوزة أو أوقات إرسال فعلية (تُعدّ في يومها).
 */
export function nextSlots(now: Date, count: number, taken: Date[], s: OutreachSettings, maxDays = 120): Date[] {
  const perDay = new Map<string, number>();
  const key = (d: { y: number; m: number; d: number }) => `${d.y}-${d.m}-${d.d}`;
  for (const t of taken) perDay.set(key(cairoDate(t)), (perDay.get(key(cairoDate(t))) ?? 0) + 1);
  const takenMs = new Set(taken.map((t) => Math.round(t.getTime() / 60_000)));
  const earliest = now.getTime() + 5 * 60_000;
  const out: Date[] = [];
  let day = cairoDate(now);
  for (let i = 0; i < maxDays && out.length < count; i++, day = nextCairoDay(day)) {
    let used = perDay.get(key(day)) ?? 0;
    for (const slot of daySlots(day, s)) {
      if (out.length >= count || used >= s.dailyCap) break;
      if (slot.getTime() < earliest || takenMs.has(Math.round(slot.getTime() / 60_000))) continue;
      out.push(slot);
      used++;
    }
  }
  return out;
}

/** تنظيف الرسالة الافتتاحية: بلا روابط ولا أرقام أسعار ولا علامات تنسيق، وبطول مناسب لرسالة أولى. */
export function cleanOpener(text: string): string | null {
  const t = text
    .replace(/[*_`#>]/g, "")
    .replace(/^["«]|["»]$/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (t.length < 60 || t.length > 650) return null;
  if (/https?:\/\/|www\.|\.com\b/i.test(t)) return null;
  if (/\d{3,}\s*(ج|جنيه|EGP|LE)/i.test(t) || /(599|2,?499|1,?299)/.test(t)) return null;
  return t;
}

/** رسالة احتياطية حتمية إن تعذرت الصياغة المخصصة (نفس روح الرسالة: مدح محدد + طلب صاحب البراند). */
export function fallbackOpener(lead: { brandName?: string | null; handle: string; note?: string | null }): string {
  // اسم الحساب اللاتيني لا يُنادى به؛ بلا اسم براند مكتوب تكون التحية عامة.
  const name = lead.brandName?.trim();
  return `مساء الخير${name ? ` يا ${name}` : ""} ✨\nبنتابع شغلكم وبجد الكولكشن الأخير شيك جداً.\nعندنا عرض لصاحب البراند أو المسؤول عن المبيعات ممكن يفرق معاكم في الطلبات من إنستجرام. ممكن توصّلونا بيه هنا في الشات؟ 🤍`;
}
