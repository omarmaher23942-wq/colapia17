// ownership-window.ts — مهلة نقل المتجر المدفوع إلى حسابات التاجر (قرار المالك: المنصة لا تستضيف متجراً مدفوعاً بلا حد).
// منطق خالص مختبَر يعتمد على تاريخ التفعيل وحده (لا عمود جديد):
//  - «open»: من التفعيل حتى OWN_WINDOW_HOURS: كل شيء يعمل، وتذكير بارز في كل صفحات اللوحة.
//  - «overdue»: انتهت المهلة ولم يكتمل النقل: المتجر لا يستقبل طلبات، واللوحة صفحة «امتلك متجرك» فقط (النقل نفسه يعمل).
//  - بعد OWN_PURGE_DAYS من انتهاء المهلة تُحذف بيانات المتجر من المنصة (مهمة own.purge مع تحذير قبلها).
// المتجر الذي بدأ استلامه فعلاً (importing) لا يُحذف حتى ينتهي أو يُلغى.

import { EDITION } from "./edition";

/**
 * مفتاح التشغيل: مهلة النقل وحذف البيانات خاصان بنموذج «ننقل المتجر لحسابات التاجر».
 * في نموذج الاستضافة (الافتراضي بقرار المالك 2026-10-10) المنصة تستضيف المتجر المدفوع، فلا مهلة ولا حذف.
 * يُفعَّل فقط بـ OWN_DEADLINE_ENABLED=1.
 */
export const OWN_DEADLINE_ENABLED = process.env.OWN_DEADLINE_ENABLED === "1";

export const OWN_WINDOW_HOURS = 72;
export const OWN_PURGE_DAYS = 14;

const H = 36e5;
const D = 24 * H;

export type OwnWindow =
  | { phase: "none" }
  | { phase: "owned" }
  | { phase: "open"; deadline: Date; msLeft: number; purgeAt: Date }
  | { phase: "overdue"; deadline: Date; purgeAt: Date };

/** بداية تطبيق المهلة: متجر فُعِّل قبلها تُحسب مهلته من هذا التاريخ، لا من تفعيله القديم (لا يُغلق فجأة). */
export const OWN_POLICY_SINCE = new Date("2026-10-12T00:00:00+02:00");

export function ownDeadline(activatedAt: Date): Date {
  const start = Math.max(activatedAt.getTime(), OWN_POLICY_SINCE.getTime());
  return new Date(start + OWN_WINDOW_HOURS * H);
}

export function ownPurgeAt(activatedAt: Date): Date {
  return new Date(ownDeadline(activatedAt).getTime() + OWN_PURGE_DAYS * D);
}

export function ownWindow(store: { status: string; activatedAt: Date | null; ownedAt: Date | null }, now = new Date(), edition: string = EDITION, enabled: boolean = OWN_DEADLINE_ENABLED): OwnWindow {
  // مشروع التاجر نفسه هو المتجر بعد النقل: لا مهلة فيه.
  if (edition !== "platform") return { phase: "none" };
  if (store.ownedAt) return { phase: "owned" };
  if (!enabled) return { phase: "none" };
  if (store.status !== "active" || !store.activatedAt) return { phase: "none" };
  const deadline = ownDeadline(store.activatedAt);
  const purgeAt = ownPurgeAt(store.activatedAt);
  const msLeft = deadline.getTime() - now.getTime();
  return msLeft > 0 ? { phase: "open", deadline, msLeft, purgeAt } : { phase: "overdue", deadline, purgeAt };
}
