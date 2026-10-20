import { describe, expect, it } from "vitest";
import { defaultBlueprint } from "@/blueprint/defaults";
import { applyChanges } from "@/lib/blueprint-patch";
import { changesAllowed, normalizePolicies, policyChanges, policyIssue, poundsToPiasters } from "@/lib/policy-changes";

const bp = defaultBlueprint({ name: "متجر", tagline: "x", industry: "shoes", email: "a@b.co", inspectionAllowed: true, storeId: "s", productCount: 3, hasHeroImages: false, variationSeed: "t", toneOfVoice: "premium_formal" });
const draft = () => ({ returns: { ...bp.returns }, shipping: { ...bp.shipping } });

describe("سياسات: الهدية وإلغاء العميل", () => {
  it("لا تغييرات إن لم يتغير شيء", () => {
    expect(policyChanges(bp, draft())).toEqual([]);
  });
  it("تفعيل الهدية يحفظ الرسوم بالقروش، وتعطيلها يمسحها", () => {
    const d = draft();
    d.shipping = { ...d.shipping, giftEnabled: true, giftWrapPiasters: poundsToPiasters(25) };
    const ch = policyChanges(bp, d);
    expect(ch).toEqual(expect.arrayContaining([{ path: ["shipping", "giftEnabled"], value: true }, { path: ["shipping", "giftWrapPiasters"], value: 2500 }]));
    const on = applyChanges(bp as unknown as Record<string, unknown>, ch) as unknown as typeof bp;
    expect(on.shipping.giftEnabled).toBe(true);
    const off = normalizePolicies(on, { returns: on.returns, shipping: { ...on.shipping, giftEnabled: false } });
    expect(off.shipping.giftEnabled).toBe(false);
    expect(off.shipping.giftWrapPiasters).toBeUndefined();
  });
  it("إلغاء العميل مغلق افتراضياً، وتغييره مسار واحد فقط", () => {
    expect(bp.returns.allowCustomerCancel).toBe(false);
    const d = draft();
    d.returns = { ...d.returns, allowCustomerCancel: true };
    expect(policyChanges(bp, d)).toEqual([{ path: ["returns", "allowCustomerCancel"], value: true }]);
  });
  it("مدة «لا يوجد» تعطل الاستبدال والاسترجاع، والاستلام يمسح العنوان عند التعطيل", () => {
    const d = draft();
    d.returns = { ...d.returns, windowDays: 0 };
    d.shipping = { ...d.shipping, pickupEnabled: false, pickupAddress: "عنوان قديم" };
    const n = normalizePolicies(bp, d);
    expect(n.returns).toMatchObject({ allowExchange: false, allowRefund: false });
    expect(n.shipping.pickupAddress).toBeUndefined();
  });
  it("التحقق والقائمة البيضاء", () => {
    const d = draft();
    d.shipping = { ...d.shipping, giftEnabled: true, giftWrapPiasters: 200_000 };
    expect(policyIssue(d)).toMatch(/رسوم التغليف/);
    expect(policyIssue({ ...draft(), shipping: { ...bp.shipping, pickupEnabled: true, pickupAddress: " " } })).toMatch(/عنوان الاستلام/);
    expect(changesAllowed([{ path: ["returns", "allowCustomerCancel"], value: true }])).toBe(true);
    expect(changesAllowed([{ path: ["shipping", "giftEnabled"], value: true }])).toBe(true);
    expect(changesAllowed([{ path: ["payments", "cod"], value: {} }])).toBe(false);
    expect(changesAllowed([{ path: ["shipping"], value: {} }])).toBe(false);
    expect(poundsToPiasters(12.5)).toBe(1250);
    expect(poundsToPiasters(-3)).toBe(0);
    expect(poundsToPiasters(99999)).toBe(100_000);
  });
});
