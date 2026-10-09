import { describe, expect, it } from "vitest";
import { billingStage, type BillingPayment, type BillingStore } from "@/lib/billing-stage";

const now = new Date("2026-10-09T12:00:00Z");
const H = 36e5;
const store = (p: Partial<BillingStore> = {}): BillingStore => ({
  status: "trial",
  demoExpiresAt: new Date(now.getTime() + 5 * H),
  doomAt: null,
  frozenAt: null,
  purgeAt: null,
  activatedAt: null,
  ownedAt: null,
  ...p,
});
const pay = (status: BillingPayment["status"], hoursAgo = 1, note: string | null = null): BillingPayment => ({
  id: `${status}-${hoursAgo}`,
  status,
  method: "vodafone_cash",
  amountPiasters: 89900,
  senderPhone: "01012345678",
  screenshotUrl: "https://x.ufs.sh/f/a",
  reviewNote: note,
  reviewedAt: null,
  createdAt: new Date(now.getTime() - hoursAgo * H),
});

describe("مرحلة الدفع", () => {
  it("التجربة الجارية: موعد التجميد ثم الحذف بعد مهلة السماح", () => {
    const s = billingStage(store(), [], 7, now);
    expect(s.kind).toBe("pay");
    if (s.kind !== "pay") return;
    expect(s.phase).toBe("trial");
    expect(s.freezeAt?.getTime()).toBe(now.getTime() + 5 * H);
    expect(s.deleteAt?.getTime()).toBe(now.getTime() + 5 * H + 7 * 24 * H);
  });

  it("انتهت التجربة ولم يُجمَّد بعد: لا موعد تجميد في المستقبل", () => {
    const s = billingStage(store({ demoExpiresAt: new Date(now.getTime() - H) }), [], 7, now);
    expect(s.kind === "pay" && s.phase).toBe("expired");
    expect(s.kind === "pay" && s.freezeAt).toBeNull();
  });

  it("المجمّد: الحذف عند doomAt إن وُجد وإلا purgeAt", () => {
    const purgeAt = new Date(now.getTime() + 48 * H);
    const doomAt = new Date(now.getTime() + 10 * H);
    const a = billingStage(store({ status: "frozen", purgeAt }), [], 7, now);
    expect(a.kind === "pay" && a.deleteAt).toEqual(purgeAt);
    const b = billingStage(store({ status: "frozen", purgeAt, doomAt }), [], 7, now);
    expect(b.kind === "pay" && b.deleteAt).toEqual(doomAt);
  });

  it("إيصال قيد المراجعة يتقدم على أي مرحلة دفع", () => {
    const s = billingStage(store({ status: "frozen" }), [pay("under_review", 0.1), pay("rejected", 5)], 7, now);
    expect(s.kind).toBe("review");
  });

  it("الرفض الأخير يظهر بسببه، ومهلته من doomAt", () => {
    const doomAt = new Date(now.getTime() + 20 * H);
    const s = billingStage(store({ doomAt }), [pay("rejected", 2, "المبلغ ناقص")], 7, now);
    expect(s.kind === "pay" && s.phase).toBe("rejected");
    expect(s.kind === "pay" && s.rejected?.reviewNote).toBe("المبلغ ناقص");
    expect(s.kind === "pay" && s.deleteAt).toEqual(doomAt);
  });

  it("المفعّل: ينتقل للاستلام، والمستلَم انتهى من الدفع", () => {
    const a = billingStage(store({ status: "active", activatedAt: now }), [pay("confirmed")], 7, now);
    expect(a.kind).toBe("active");
    expect(a.kind === "active" && a.payment?.status).toBe("confirmed");
    expect(billingStage(store({ status: "active", ownedAt: now }), [], 7, now).kind).toBe("owned");
  });

  it("متجر قيد البناء أو موقوف لا يُعرض عليه دفع", () => {
    expect(billingStage(store({ status: "building" }), [], 7, now)).toEqual({ kind: "unavailable", reason: "building" });
    expect(billingStage(store({ status: "suspended" }), [], 7, now)).toEqual({ kind: "unavailable", reason: "suspended" });
  });
});
