// subdomain-change.ts — تغيير رابط المتجر (النطاق الفرعي) من الإعدادات (V3 D1). منطق خالص بلا تبعيات خادم حتى يقرأ الوسيط
// (Edge) بادئة مفتاح التحويل نفسها. الرابط القديم يحوّل 308 للجديد مدة REDIRECT_DAYS، ولا يأخذه متجر آخر خلالها.
import { isReservedSubdomain, SUBDOMAIN_RE } from "./subdomains";

/** مفتاح Redis للتحويل: sdr:<القديم> = الجديد (بمدة انتهاء). يقرؤه middleware.ts. */
export const SUBDOMAIN_REDIRECT_PREFIX = "sdr:";
export const subdomainRedirectKey = (sub: string) => `${SUBDOMAIN_REDIRECT_PREFIX}${sub.toLowerCase()}`;

export const REDIRECT_DAYS = 30;
/** تغييرات الرابط المسموحة لكل متجر خلال 30 يوماً (الرابط يُنشر في البايو والإعلانات، فالتغيير المتكرر يضر المتجر نفسه). */
export const MAX_CHANGES_PER_30D = 3;

export type PreviousSubdomain = { sub: string; until: string };

export type SubdomainCheck = { ok: true; value: string } | { ok: false; error: string };

/** ينظف ما يكتبه التاجر: حروف صغيرة، الأرقام العربية، والمسافات والنقاط شرطات، ويقبل لصق الرابط كاملاً. */
export function normalizeSubdomainInput(raw: string, rootDomain = ""): string {
  let s = String(raw ?? "").trim().toLowerCase();
  s = s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  s = s.replace(/^https?:\/\//, "").split("/")[0] ?? "";
  const root = rootDomain.toLowerCase().split(":")[0];
  if (root && s.endsWith(`.${root}`)) s = s.slice(0, -(root.length + 1));
  else s = s.split(":")[0] ?? "";
  return s.replace(/[\s_.]+/g, "-").replace(/-{2,}/g, "-");
}

/** التحقق من الصيغة فقط (التوفر يُفحص على الخادم). */
export function validateSubdomain(raw: string, current: string, rootDomain = ""): SubdomainCheck {
  const v = normalizeSubdomainInput(raw, rootDomain);
  if (!v) return { ok: false, error: "اكتبوا الرابط الجديد." };
  if (v === current.toLowerCase()) return { ok: false, error: "هذا هو رابط المتجر الحالي." };
  if (v.length < 3) return { ok: false, error: "الرابط من 3 أحرف على الأقل." };
  if (v.length > 30) return { ok: false, error: "الرابط 30 حرفاً على الأكثر." };
  if (/[^a-z0-9-]/.test(v)) return { ok: false, error: "استخدموا حروفاً إنجليزية صغيرة وأرقاماً وشرطة (-) فقط." };
  if (v.startsWith("-") || v.endsWith("-")) return { ok: false, error: "لا يبدأ الرابط ولا ينتهي بشرطة." };
  if (!SUBDOMAIN_RE.test(v) || v.includes("--")) return { ok: false, error: "صيغة الرابط غير صحيحة." };
  if (isReservedSubdomain(v) || /^(xn--|www\d*$)/.test(v)) return { ok: false, error: "هذا الرابط محجوز، جرّبوا اسماً آخر." };
  return { ok: true, value: v };
}

/** الروابط القديمة التي ما زالت تحوّل (تُحذف المنتهية). */
export function activePrevious(prefs: unknown, now = Date.now()): PreviousSubdomain[] {
  const list = (prefs as { previousSubdomains?: unknown } | null)?.previousSubdomains;
  if (!Array.isArray(list)) return [];
  return list
    .filter((x): x is PreviousSubdomain => !!x && typeof (x as PreviousSubdomain).sub === "string" && typeof (x as PreviousSubdomain).until === "string")
    .filter((x) => new Date(x.until).getTime() > now);
}

/** القائمة بعد التغيير: القديم يُضاف بمهلة 30 يوماً، والجديد يُحذف منها إن كان رجوعاً لرابط سابق. */
export function nextPrevious(prefs: unknown, from: string, to: string, now = Date.now()): PreviousSubdomain[] {
  const until = new Date(now + REDIRECT_DAYS * 86_400_000).toISOString();
  const kept = activePrevious(prefs, now).filter((p) => p.sub !== to && p.sub !== from);
  return [...kept, { sub: from, until }].slice(-5);
}

/** ثواني بقاء مفتاح التحويل حتى موعده. */
export const ttlSeconds = (until: string, now = Date.now()) => Math.max(60, Math.round((new Date(until).getTime() - now) / 1000));
