import "server-only";
// guard.ts — حماية استمارة طلب المتجر العامة (بلا تسجيل دخول) من الإساءة والإغراق.
//
// الطبقات: مفتاح إيقاف من اللوحة (feature_flags «intake») ← نفس المصدر (Origin) ← حدود معدل لكل عملية ←
// فخ للبرامج الآلية (حقل مخفي + أقل زمن ملء) ← قرار الإرسال (decideIntake): طلب مفتوح لنفس وسيلة التواصل من
// القاعدة (لا يتأثر بتعطل Redis)، ثم حدود البريد والرقم والشبكة، ثم سقف يومي عام بأكبر العدّين (Redis والقاعدة).
// Redis متعطل = نسمح (تجربة العميل أهم) والقاعدة تبقى الحماية الأخيرة.
import { createHash } from "node:crypto";
import { and, count, desc, eq, gte, ne, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { platformUsers } from "@/db/schema";
import { storeRequests } from "@/db/schema/agency";
import { redis } from "@/lib/redis";
import { clientEnv, getOwnerAlertEmails } from "@/lib/env";
import { normalizeEgyptianPhone } from "@/lib/phone";
import { clientIp, ipBucket } from "@/lib/client-ip";
import { getFlag } from "@/lib/flags";
import { notifyAdmin } from "@/ai/lifecycle/notify";
import { NextResponse } from "next/server";
import { decideIntake, limitsFrom, OPEN_REQUEST_DAYS, type IntakeDecision, type IntakeLimits } from "./rules";
import { canonicalEmail } from "./schema";
import { DEFAULT_CAPACITY_PER_DAY } from "./eta";

export const INTAKE_FLAG = "intake";
/** أقل زمن حقيقي لملء الاستمارة: أسرع من ذلك = برنامج آلي (يُقبل بصمت ولا يُنشأ طلب). */
export const MIN_FILL_MS = 8_000;

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export type IntakeSettings = { enabled: boolean; limits: IntakeLimits; capacityPerDay: number; /** بريد أو رقم معفى من حدود التكرار (لتجربة الفريق). */ bypass: string[] };

/** إعداد الاستمارة من لوحة المالك (/admin/flags): التشغيل، والحدود، وطاقة الفريق اليومية لحساب موعد التسليم. */
export async function intakeSettings(): Promise<IntakeSettings> {
  const f = await getFlag<Record<string, unknown>>(INTAKE_FLAG).catch(() => ({ enabled: true, config: null }));
  const cap = Number(f.config?.capacityPerDay);
  return {
    enabled: f.enabled,
    limits: limitsFrom(f.config),
    capacityPerDay: Number.isInteger(cap) && cap > 0 && cap <= 100 ? cap : DEFAULT_CAPACITY_PER_DAY,
    bypass: Array.isArray(f.config?.bypass) ? (f.config!.bypass as unknown[]).filter((v): v is string => typeof v === "string").slice(0, 50) : [],
  };
}

/**
 * هل صاحب الطلب من فريقنا؟ بريده من بريد المالك/المالكين أو عضو نشط في فريق الوكالة، أو بريده/رقمه في «intake.bypass»
 * بلوحة الأعلام. هؤلاء يجرّبون الاستمارة مراراً، فلا تنطبق عليهم حدود التكرار (وتبقى حماية الإغراق العامة: حدود
 * المعدل على الطلبات نفسها). التطبيع نفسه الذي يُحفظ به الطلب فيتطابق ما كتبه.
 */
export async function isTeamContact(input: { email: string | null; whatsapp: string | null }, settings: Pick<IntakeSettings, "bypass">): Promise<boolean> {
  const email = input.email ? canonicalEmail(input.email) : null;
  const listed = new Set(settings.bypass.map((v) => (v.includes("@") ? canonicalEmail(v) : (normalizeEgyptianPhone(v) ?? v.trim()))));
  if (email && (listed.has(email) || getOwnerAlertEmails().some((e) => canonicalEmail(e) === email))) return true;
  if (input.whatsapp && listed.has(input.whatsapp)) return true;
  if (input.email) {
    const [member] = await db
      .select({ id: platformUsers.id })
      .from(platformUsers)
      .where(and(eq(platformUsers.isActive, true), sql`lower(${platformUsers.email}) = ${input.email.toLowerCase()}`))
      .limit(1)
      .catch(() => []);
    if (member) return true;
  }
  return false;
}

/** أحدث طلب مفتوح (مُرسَل ولم يُسلَّم، خلال المدة) لنفس البريد أو الرقم، أو null. */
export async function findOpenRequest(input: { email: string | null; whatsapp: string | null; excludeId?: string }) {
  const contact = [input.email ? eq(storeRequests.email, input.email) : undefined, input.whatsapp ? eq(storeRequests.whatsapp, input.whatsapp) : undefined].filter((c): c is NonNullable<typeof c> => Boolean(c));
  if (!contact.length) return null;
  const [row] = await db
    .select()
    .from(storeRequests)
    .where(
      and(
        eq(storeRequests.status, "submitted"),
        ne(storeRequests.stage, "delivery"),
        gte(storeRequests.submittedAt, sql`now() - interval '${sql.raw(String(OPEN_REQUEST_DAYS))} days'`),
        input.excludeId ? ne(storeRequests.id, input.excludeId) : undefined,
        or(...contact),
      ),
    )
    .orderBy(desc(storeRequests.submittedAt))
    .limit(1);
  return row ?? null;
}

/**
 * الطلبات المُغيّرة تأتي من صفحات المنصة نفسها فقط (حماية CSRF لمسارات الـ API): المصدر (Origin ثم Referer) يطابق
 * عنوان المنصة المعلن أو المضيف الذي وصله الطلب نفسه (نشرات المعاينة ونطاق www). صفحة غريبة لا تستطيع جعل
 * متصفح الزائر يرسل مصدراً يطابق مضيف المنصة.
 */
export function sameOrigin(req: Request): boolean {
  const expected = new URL(clientEnv.NEXT_PUBLIC_APP_URL).origin;
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0]?.trim().toLowerCase();
  const ok = (value: string) => {
    try {
      const u = new URL(value);
      return u.origin === expected || (Boolean(host) && u.host.toLowerCase() === host && (u.protocol === "https:" || u.hostname === "localhost"));
    } catch {
      return false;
    }
  };
  const origin = req.headers.get("origin");
  if (origin) return ok(origin);
  const referer = req.headers.get("referer");
  return referer ? ok(referer) : false;
}

export const requestIp = (req: Request) => ipBucket(clientIp(req.headers));

/** عدّاد نافذة ثابتة. يُرجع false عند تجاوز الحد. */
export async function hit(key: string, limit: number, windowS: number): Promise<boolean> {
  try {
    // المفتاح مجزّأ: عنوان الشبكة والرقم لا يظهران نصاً في Redis.
    const k = `rl:intake:${digest(key)}`;
    const p = redis.pipeline();
    p.set(k, 0, { nx: true, ex: windowS });
    p.incr(k);
    const res = await p.exec<[unknown, number]>();
    return (res[1] ?? 0) <= limit;
  } catch (e) {
    console.error("[intake] rate limit failed, allowing", e);
    return true;
  }
}

/** الحقل المخفي ممتلئ: برنامج آلي مؤكد (لا يراه إنسان). يُقبل بصمت حتى لا يتعلم البرنامج تجاوزه. */
export const filledHoneypot = (honeypot: unknown): boolean => typeof honeypot === "string" && honeypot.trim().length > 0;

/**
 * كم ينتظر الإرسال بعد (0 = مسموح). إرسال أسرع من MIN_FILL_MS من إنشاء المسودة لا يُرفض ولا يُقبل بصمت: إنسان
 * سريع (أو أعاد تحميل الصفحة) قد يفعلها، فنرد بمدة انتظار والاستمارة تعيد المحاولة وحدها.
 */
export function submitWaitMs(createdAt: Date, now = new Date()): number {
  return Math.max(0, MIN_FILL_MS - (now.getTime() - createdAt.getTime()));
}

const cairoDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
const digest = (v: string) => createHash("sha256").update(v).digest("hex").slice(0, 24);
/** مفتاح عدّاد/إرسال لبريد بصيغته الموحّدة (a.b+x@gmail.com = ab@gmail.com). */
export const emailKey = (email: string) => digest(canonicalEmail(email));

async function readCounters(keys: string[]): Promise<number[]> {
  try {
    const vals = await redis.mget<(number | string | null)[]>(...keys);
    return vals.map((v) => Number(v ?? 0) || 0);
  } catch {
    return keys.map(() => 0);
  }
}

async function bump(entries: [string, number][]): Promise<void> {
  try {
    const p = redis.pipeline();
    for (const [k, ttl] of entries) {
      p.incr(k);
      p.expire(k, ttl);
    }
    await p.exec();
  } catch (e) {
    console.error("[intake] counter failed", e);
  }
}

/** عدّادات تُرفع بعد نجاح الإرسال فقط (مفتاح، مدة بالثواني). */
export type IntakeCounters = [string, number][];
export type IntakeCheck = { decision: IntakeDecision; counters: IntakeCounters };

/**
 * يفحص الإرسال دون أن يحجز شيئاً: العدّادات لا تُرفع إلا في commitIntake بعد أن يُحفظ الطلب فعلاً، فخطأ مؤقت في
 * القاعدة أو ضغطتان متزامنتان لا تحرقان حصة العميل ولا تمنعانه من إعادة المحاولة. email/whatsapp بعد التطبيع (أو null).
 */
export async function checkIntake(input: { ip: string; email: string | null; whatsapp: string | null; limits: IntakeLimits; /** فريقنا يجرّب: بلا حدود تكرار. */ team?: boolean }): Promise<IntakeCheck> {
  if (input.team) return { decision: { ok: true }, counters: [] };
  const day = cairoDay();
  // كل المفاتيح مجزّأة: لا عنوان شبكة ولا رقم هاتف نصاً في Redis.
  const keys = {
    email: input.email ? `intake:email:${emailKey(input.email)}` : null,
    phone: input.whatsapp ? `intake:phone:${digest(input.whatsapp)}` : null,
    ip: input.ip && input.ip !== "0.0.0.0" ? `intake:ip:${digest(input.ip)}` : null,
    day: `intake:day:${day}`,
  };

  const contact = [
    input.email ? eq(storeRequests.email, input.email) : undefined,
    input.whatsapp ? eq(storeRequests.whatsapp, input.whatsapp) : undefined,
  ].filter((c): c is NonNullable<typeof c> => Boolean(c));

  const [openRows, todayRows, counters] = await Promise.all([
    contact.length
      ? db
          .select({ n: count() })
          .from(storeRequests)
          .where(
            and(
              eq(storeRequests.status, "submitted"),
              ne(storeRequests.stage, "delivery"),
              gte(storeRequests.submittedAt, sql`now() - interval '${sql.raw(String(OPEN_REQUEST_DAYS))} days'`),
              or(...contact),
            ),
          )
      : Promise.resolve([{ n: 0 }]),
    db
      .select({ n: count() })
      .from(storeRequests)
      .where(
        and(
          eq(storeRequests.status, "submitted"),
          gte(storeRequests.submittedAt, sql`date_trunc('day', now() at time zone 'Africa/Cairo') at time zone 'Africa/Cairo'`),
        ),
      ),
    readCounters([keys.email ?? "intake:none", keys.phone ?? "intake:none", keys.ip ?? "intake:none", keys.day]),
  ]);

  const [email7d = 0, phone7d = 0, ip24h = 0, dayCount = 0] = counters;
  const decision = decideIntake(
    {
      openForContact: Number(openRows[0]?.n ?? 0),
      email7d: keys.email ? email7d : 0,
      phone7d: keys.phone ? phone7d : 0,
      ip24h: keys.ip ? ip24h : 0,
      today: Math.max(dayCount, Number(todayRows[0]?.n ?? 0)),
    },
    input.limits,
  );

  if (!decision.ok) {
    if (decision.reason === "daily") {
      const first = await redis.set(`intake:cap-alert:${day}`, 1, { nx: true, ex: 172_800 }).catch(() => null);
      if (first) await notifyAdmin(`استمارة الوكالة بلغت السقف اليومي (${input.limits.dailyCap} طلباً). ارفعه من إعدادات «intake» في اللوحة إن كان الإقبال حقيقياً.`);
    }
    return { decision, counters: [] };
  }

  const week = 7 * 86_400;
  return {
    decision,
    counters: [
      keys.email ? ([keys.email, week] as [string, number]) : null,
      keys.phone ? ([keys.phone, week] as [string, number]) : null,
      keys.ip ? ([keys.ip, 86_400] as [string, number]) : null,
      [keys.day, 129_600] as [string, number],
    ].filter((e): e is [string, number] => e !== null),
  };
}

/** يرفع عدّادات إرسال تم حفظه (بعد submitRequest). */
export const commitIntake = (counters: IntakeCounters): Promise<void> => (counters.length ? bump(counters) : Promise.resolve());
