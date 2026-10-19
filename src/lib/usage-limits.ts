// usage-limits.ts — حدود الاستخدام حسب باقة المتجر (V3-PLAN 3): أي باقة تنطبق، والعدّادات، ورسائل الحد بتلميح ترقية.
// منطق خالص مختبَر. الحدود نفسها من نموذج الأسعار (lib/platform-pricing.ts) ويعدّلها المالك من /admin/pricing.
import { fmtEgp, fmtStorage, planIdFrom, TRIAL_PLAN, type HostingPlan, type PlanId, type PlanLimits, type PricingModel } from "@/lib/platform-pricing";

export type PlanStore = { status: string; plan?: string | null; prefs?: Record<string, unknown> | null };

/**
 * باقة المتجر الفعلية: المتجر المدفوع بباقته المسجّلة (stores.plan، أو prefs.planId احتياطاً)، والمدفوع قديماً بلا باقة
 * معروفة = «النمو». كل ما سوى ذلك (تجربة، تجميد، إعداد) يستخدم حدود «النمو» كتجربة.
 */
export function storePlanId(store: PlanStore): { planId: PlanId; isTrial: boolean } {
  if (store.status !== "active") return { planId: TRIAL_PLAN, isTrial: true };
  const id = planIdFrom(store.plan) ?? planIdFrom((store.prefs ?? {}).planId) ?? "growth";
  return { planId: id, isTrial: false };
}

export function planFor(model: PricingModel, planId: PlanId): HostingPlan {
  return model.plans.find((p) => p.id === planId) ?? model.plans[1] ?? model.plans[0]!;
}

type NumericLimit = Exclude<keyof PlanLimits, "customDomain">;

/** أول باقة أعلى تتيح أكثر في هذا الحد (أو تتيح النطاق الخاص)، أو null إن كانت الحالية الأعلى. */
export function upgradeFor(model: PricingModel, planId: PlanId, key: keyof PlanLimits): HostingPlan | null {
  const order = model.plans.map((p) => p.id);
  const cur = planFor(model, planId);
  const idx = order.indexOf(cur.id);
  for (const p of model.plans.slice(idx + 1)) {
    if (key === "customDomain" ? p.limits.customDomain : p.limits[key as NumericLimit] > cur.limits[key as NumericLimit]) return p;
  }
  return null;
}

const DESCRIBE: Record<NumericLimit, (n: number) => string> = {
  products: (n) => `حتى ${fmtEgp(n)} منتج`,
  storageBytes: (n) => `${fmtStorage(n)} للصور والفيديو`,
  videos: (n) => `${fmtEgp(n)} فيديو`,
  videoMaxBytes: (n) => `فيديو حتى ${fmtStorage(n)}`,
  aiPerMonth: (n) => `${fmtEgp(n)} عملية تلقائية شهرياً`,
  visualSearchPerMonth: (n) => `${fmtEgp(n)} بحث بالصورة شهرياً`,
  teamMembers: (n) => `${fmtEgp(n)} أعضاء في الفريق`,
};

/** «باقة «النمو» تتيح حتى 2,000 منتج، ويمكن الترقية من صفحة الاشتراك.» — أو فارغ إن لم توجد باقة أعلى. */
export function upgradeHint(model: PricingModel, planId: PlanId, key: keyof PlanLimits): string {
  const up = upgradeFor(model, planId, key);
  if (!up) return "";
  if (key === "customDomain") return `النطاق الخاص متاح في باقة «${up.name}»، ويمكن الترقية من صفحة الاشتراك.`;
  return `باقة «${up.name}» تتيح ${DESCRIBE[key as NumericLimit](up.limits[key as NumericLimit])}، ويمكن الترقية من صفحة الاشتراك.`;
}

export type MeterTone = "ok" | "warn" | "bad";
export type Meter = { used: number; limit: number; pct: number; remaining: number; tone: MeterTone };

export function meter(used: number, limit: number): Meter {
  const u = Math.max(0, used);
  const pct = limit <= 0 ? 100 : Math.min(100, Math.round((u / limit) * 100));
  return { used: u, limit, pct, remaining: Math.max(0, limit - u), tone: pct >= 100 ? "bad" : pct >= 80 ? "warn" : "ok" };
}

const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

/** مفتاح الشهر الحالي بتوقيت القاهرة (YYYY-MM). */
export function usageMonth(now = new Date()): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit" }).formatToParts(now);
  return `${p.find((x) => x.type === "year")!.value}-${p.find((x) => x.type === "month")!.value}`;
}

/** تاريخ التجدد بالعربية: «1 نوفمبر». */
export function nextResetLabel(now = new Date()): string {
  const m = Number(usageMonth(now).split("-")[1]);
  return `1 ${MONTHS[m % 12]}`;
}

/** رسالة حد شهري (يتجدد مطلع الشهر) مع تلميح الترقية إن وُجد. */
export function monthlyLimitMessage(what: string, limit: number, hint = "", now = new Date()): string {
  return `وصلتم إلى حد ${what} هذا الشهر (${fmtEgp(limit)}). يتجدد الحد في ${nextResetLabel(now)}.${hint ? ` ${hint}` : ""}`;
}

/** رسالة حد إجمالي (لا يتجدد شهرياً) مع تلميح الترقية إن وُجد. */
export function totalLimitMessage(what: string, limitText: string, hint = ""): string {
  return `وصلتم إلى حد ${what} في باقتكم (${limitText}).${hint ? ` ${hint}` : " يمكن حذف ما لا تحتاجونه لإفساح المجال."}`;
}

export const fmtBytes = fmtStorage;
