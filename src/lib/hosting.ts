// hosting.ts — حالة استضافة المتجر المدفوع على المنصة (اشتراك بمدة 3 أو 6 أو 12 شهراً، docs/V2-PLAN.md).
// منطق خالص مختبَر يعتمد على stores.hosting_expires_at:
//  - active: يعمل حتى تاريخ الانتهاء. renew_soon: أقل من RENEW_SOON_DAYS، فيظهر تذكير التجديد في اللوحة.
//  - grace: انتهى الاشتراك، والمتجر ما زال يعمل graceDays يوماً (قابلة للضبط من إعداد «lifecycle»، افتراضي 3).
//  - paused: بعد السماح يتوقف المتجر عن الظهور للزوار ويُعرض التجديد، و**لا يُحذف شيء أبداً**؛ التجديد يعيده فوراً.
//  - offline: صاحب المتجر أوقف نسخته على المنصة بنفسه.
// لا توجد استضافة «مدى الحياة»: الدائرة الذهبية باقة بمدة (3 أشهر افتراضياً) ثم تجديد عادي.
// المتجر غير المدفوع (تجربة/تجميد) خارج هذا الملف: له مراحله في lib/billing-stage.ts.

import { EDITION } from "./edition";

/** مدة الاشتراك الافتراضية لدفعة قديمة بلا مدة مسجّلة. */
export const DEFAULT_PLAN_MONTHS = 12;
/** مهلة السماح الافتراضية بعد الانتهاء (الأيام). تُضبط من إعداد «lifecycle» ← graceDays. */
export const HOSTING_GRACE_DAYS = 3;
export const RENEW_SOON_DAYS = 30;
/** التجديد متاح قبل الانتهاء بهذه المدة (ودائماً في السماح والإيقاف). */
export const RENEW_OPEN_DAYS = 60;

const DAY = 864e5;

export type HostingStore = {
  status: string;
  plan?: string | null;
  planMonths?: number | null;
  activatedAt: Date | null;
  hostingExpiresAt: Date | null;
  platformOfflineAt: Date | null;
  purgedAt?: Date | null;
};

export type HostingState =
  | { phase: "none" }
  | { phase: "active" | "renew_soon"; expiresAt: Date; daysLeft: number; canRenew: boolean }
  | { phase: "grace"; expiresAt: Date; pauseAt: Date; daysLeft: number }
  | { phase: "paused"; expiresAt: Date }
  | { phase: "offline"; expiresAt: Date | null };

/** يضيف أشهراً تقويمية (UTC)، ويقف عند آخر يوم في الشهر إن لم يوجد اليوم نفسه (31 يناير + شهر = 28/29 فبراير). */
export function addMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + Math.round(months));
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

/** نهاية الاستضافة: العمود، وإلا مدة الباقة من التفعيل (متجر فُعِّل قبل العمود). */
export function hostingExpiry(store: Pick<HostingStore, "activatedAt" | "hostingExpiresAt"> & { planMonths?: number | null }): Date | null {
  if (store.hostingExpiresAt) return store.hostingExpiresAt;
  return store.activatedAt ? addMonths(store.activatedAt, store.planMonths || DEFAULT_PLAN_MONTHS) : null;
}

/** تمديد بعدد أشهر من نهاية الاستضافة الحالية، أو من اليوم إن كانت انتهت (لا يدفع التاجر عن أيام توقف فيها متجره). */
export function extendHosting(current: Date | null, months: number, now = new Date()): Date {
  const from = current && current.getTime() > now.getTime() ? current : now;
  return addMonths(from, months > 0 ? months : DEFAULT_PLAN_MONTHS);
}

/** يقرأ مهلة السماح من إعداد «lifecycle» (0–30 يوماً). */
export function graceDaysFrom(v: unknown): number {
  if (v === null || v === undefined || v === "") return HOSTING_GRACE_DAYS;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 30 ? Math.round(n) : HOSTING_GRACE_DAYS;
}

export function hostingState(
  store: HostingStore,
  now = new Date(),
  edition: string = EDITION,
  graceDays: number = HOSTING_GRACE_DAYS
): HostingState {
  // مشروع التاجر الخاص يعمل على حساباته: لا اشتراك فيه.
  if (edition !== "platform") return { phase: "none" };
  if (store.status !== "active") return { phase: "none" };
  const expiresAt = hostingExpiry(store);
  if (store.platformOfflineAt || store.purgedAt) return { phase: "offline", expiresAt };
  if (!expiresAt) return { phase: "none" };
  const left = expiresAt.getTime() - now.getTime();
  if (left > 0) {
    const daysLeft = Math.ceil(left / DAY);
    return { phase: daysLeft <= RENEW_SOON_DAYS ? "renew_soon" : "active", expiresAt, daysLeft, canRenew: daysLeft <= RENEW_OPEN_DAYS };
  }
  const pauseAt = new Date(expiresAt.getTime() + graceDays * DAY);
  if (pauseAt.getTime() > now.getTime()) {
    return { phase: "grace", expiresAt, pauseAt, daysLeft: Math.ceil((pauseAt.getTime() - now.getTime()) / DAY) };
  }
  return { phase: "paused", expiresAt };
}

/** هل يُعرض المتجر للزوار ويستقبل طلبات على المنصة؟ (حالة الاستضافة فقط؛ حالات التجربة لها بوابتها.) */
export function hostingServes(state: HostingState): boolean {
  return state.phase !== "paused" && state.phase !== "offline";
}

/** هل يقبل الدفع الآن تجديداً لهذا المتجر؟ */
export function canRenewNow(state: HostingState): boolean {
  if (state.phase === "grace" || state.phase === "paused") return true;
  if (state.phase === "active" || state.phase === "renew_soon") return state.canRenew;
  return false;
}
