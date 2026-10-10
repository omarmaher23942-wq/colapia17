// billing-stage.ts — في أي مرحلة دفع يقف التاجر (صفحة /dashboard/billing). منطق خالص مختبَر: نفس قواعد دورة الحياة
// (lifecycle/scheduler.ts و payments.ts): التجربة تنتهي عند demoExpiresAt فيُجمَّد المتجر، ويُحذف بعد GRACE_DAYS؛
// ورفض الإيصال يضع doomAt (موعد حذف أقرب)؛ والإيصال قيد المراجعة يؤجل أي تجميد أو حذف حتى يُحسم.
// المتجر المفعّل له اشتراك استضافة سنوي (lib/hosting.ts): المرحلة «active» تحمل حالته وإيصال التجديد إن وُجد.

import { hostingState, type HostingState } from "./hosting";

export type BillingPayment = {
  id: string;
  kind: "setup" | "renewal";
  coversUntil: Date | null;
  status: "pending" | "under_review" | "confirmed" | "rejected" | "refunded";
  method: string;
  amountPiasters: number;
  senderPhone: string | null;
  screenshotUrl: string | null;
  reviewNote: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
};

export type BillingStore = {
  status: string;
  demoExpiresAt: Date | null;
  doomAt: Date | null;
  frozenAt: Date | null;
  purgeAt: Date | null;
  activatedAt: Date | null;
  ownedAt: Date | null;
  purgedAt: Date | null;
  hostingExpiresAt: Date | null;
  platformOfflineAt: Date | null;
};

export type PayPhase = "trial" | "expired" | "frozen" | "rejected";

export type BillingStage =
  | { kind: "owned" }
  | {
      kind: "active";
      activatedAt: Date | null;
      payment: BillingPayment | null;
      hosting: HostingState;
      /** إيصال تجديد قيد المراجعة. */
      renewalPending: BillingPayment | null;
      /** آخر إيصال تجديد مرفوض ما لم يأتِ بعده قبول. */
      renewalRejected: BillingPayment | null;
    }
  | { kind: "review"; payment: BillingPayment }
  | {
      kind: "pay";
      phase: PayPhase;
      /** متى يُجمَّد المتجر (التجربة الجارية فقط). */
      freezeAt: Date | null;
      /** متى يُحذف نهائياً إن لم يُدفع (إن كان معروفاً). */
      deleteAt: Date | null;
      rejected: BillingPayment | null;
    }
  | { kind: "unavailable"; reason: "building" | "suspended" | "deleted" };

const DAY = 864e5;

/** payments بالأحدث أولاً. */
export function billingStage(store: BillingStore, payments: BillingPayment[], graceDays: number, now = new Date()): BillingStage {
  if (store.status === "active") {
    // حذف التاجر بيانات متجره من المنصة بعد نقله: لا شيء يُدفع هنا.
    if (store.purgedAt) return { kind: "owned" };
    const latestRenewal = payments.find((p) => p.kind === "renewal" && (p.status === "rejected" || p.status === "confirmed")) ?? null;
    return {
      kind: "active",
      activatedAt: store.activatedAt,
      payment: payments.find((p) => p.status === "confirmed") ?? null,
      hosting: hostingState(store, now, "platform"),
      renewalPending: payments.find((p) => p.status === "under_review") ?? null,
      renewalRejected: latestRenewal?.status === "rejected" ? latestRenewal : null,
    };
  }
  if (store.status === "suspended") return { kind: "unavailable", reason: "suspended" };
  if (store.status === "deleted") return { kind: "unavailable", reason: "deleted" };
  if (store.status !== "trial" && store.status !== "frozen") return { kind: "unavailable", reason: "building" };

  const pending = payments.find((p) => p.status === "under_review");
  if (pending) return { kind: "review", payment: pending };

  // آخر قرار على إيصال: رفض يظهر للتاجر بسببه ما لم يأتِ بعده قبول.
  const latest = payments.find((p) => p.status === "rejected" || p.status === "confirmed") ?? null;
  const rejected = latest?.status === "rejected" ? latest : null;

  if (store.status === "frozen") {
    return { kind: "pay", phase: "frozen", freezeAt: null, deleteAt: store.doomAt ?? store.purgeAt, rejected };
  }
  if (store.doomAt) {
    return { kind: "pay", phase: "rejected", freezeAt: null, deleteAt: store.doomAt, rejected };
  }
  const end = store.demoExpiresAt;
  const deleteAt = end ? new Date(end.getTime() + graceDays * DAY) : null;
  if (end && end.getTime() > now.getTime()) return { kind: "pay", phase: "trial", freezeAt: end, deleteAt, rejected };
  return { kind: "pay", phase: "expired", freezeAt: null, deleteAt, rejected };
}
