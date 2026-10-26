// hosting.ts — متقاعد في V4/V5: لا اشتراك استضافة شهري ولا مهلة سماح ولا إيقاف بانتهاء اشتراك. المتجر الفعّال لا ينتهي.
// يبقى النوع والدوال كواجهة توافق لمن يستدعيها، وتعيد دائماً «لا حالة» و«يخدم». معاينة الـ 24 ساعة (trial/frozen) لها
// دورتها المستقلة في lifecycle/. لا تضف هنا منطق انتهاء.
export const DEFAULT_PLAN_MONTHS = 12;
export const HOSTING_GRACE_DAYS = 0;

export type HostingState =
  | { phase: "none" }
  | { phase: "active" | "renew_soon"; expiresAt: Date; daysLeft: number; canRenew: boolean }
  | { phase: "grace"; expiresAt: Date; pauseAt: Date; daysLeft: number }
  | { phase: "paused"; expiresAt: Date };

export function hostingState(..._args: unknown[]): HostingState {
  return { phase: "none" };
}
export function hostingServes(_state?: HostingState): boolean {
  return true;
}
export function canRenewNow(_state?: HostingState): boolean {
  return false;
}
export function graceDaysFrom(_v?: unknown): number {
  return 0;
}
