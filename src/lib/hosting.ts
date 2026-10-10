// hosting.ts — حالة استضافة المتجر المدفوع على المنصة (نموذج الاشتراك السنوي، قرار المالك 2026-10-10).
// منطق خالص مختبَر يعتمد على stores.hosting_expires_at وحده:
//  - active: يعمل حتى تاريخ الانتهاء. renew_soon: أقل من RENEW_SOON_DAYS، فيظهر تذكير التجديد في اللوحة.
//  - grace: انتهت السنة، والمتجر ما زال يعمل HOSTING_GRACE_DAYS يوماً مع تنبيه واضح.
//  - paused: بعد السماح يتوقف المتجر عن الظهور للزوار (صفحة «متوقف مؤقتاً»)، و**لا يُحذف شيء أبداً**؛
//    التجديد يعيده فوراً كما كان.
//  - offline: صاحب المتجر أوقف نسخته على المنصة بنفسه (بعد نقله لموقعه الخاص)، ويعيدها متى شاء.
// المتجر غير المدفوع (تجربة/تجميد) خارج هذا الملف: له مراحله في lib/billing-stage.ts.

import { EDITION } from "./edition";

export const HOSTING_YEAR_DAYS = 365;
export const HOSTING_GRACE_DAYS = 14;
export const RENEW_SOON_DAYS = 30;
/** التجديد متاح قبل الانتهاء بهذه المدة (ودائماً في السماح والإيقاف). */
export const RENEW_OPEN_DAYS = 60;

const DAY = 864e5;

export type HostingStore = {
  status: string;
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

/** نهاية الاستضافة: العمود، وإلا سنة من التفعيل (متجر فُعِّل قبل العمود). */
export function hostingExpiry(store: Pick<HostingStore, "activatedAt" | "hostingExpiresAt">): Date | null {
  if (store.hostingExpiresAt) return store.hostingExpiresAt;
  return store.activatedAt ? new Date(store.activatedAt.getTime() + HOSTING_YEAR_DAYS * DAY) : null;
}

/** تمديد سنة من نهاية الاستضافة الحالية، أو من اليوم إن كانت انتهت (لا يدفع التاجر عن أيام توقف فيها متجره). */
export function extendHosting(current: Date | null, now = new Date()): Date {
  const from = current && current.getTime() > now.getTime() ? current : now;
  return new Date(from.getTime() + HOSTING_YEAR_DAYS * DAY);
}

export function hostingState(store: HostingStore, now = new Date(), edition: string = EDITION): HostingState {
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
  const pauseAt = new Date(expiresAt.getTime() + HOSTING_GRACE_DAYS * DAY);
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
