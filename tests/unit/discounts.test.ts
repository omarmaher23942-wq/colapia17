import { describe, expect, it } from "vitest";
import { discountConditions, discountState, discountValueLabel, suggestCode } from "@/lib/discounts";

const base = { isActive: true, startsAt: null, endsAt: null, maxUses: null, usedCount: 0 };
const NOW = Date.parse("2026-10-09T12:00:00Z");

describe("discountState: نفس شروط الدفع", () => {
  it("يعمل", () => expect(discountState(base, NOW)).toBe("active"));
  it("موقوف قبل أي شيء آخر", () => expect(discountState({ ...base, isActive: false, endsAt: "2020-01-01T00:00:00Z" }, NOW)).toBe("paused"));
  it("منتهٍ", () => expect(discountState({ ...base, endsAt: "2026-10-09T11:59:00Z" }, NOW)).toBe("expired"));
  it("نفد", () => expect(discountState({ ...base, maxUses: 5, usedCount: 5 }, NOW)).toBe("exhausted"));
  it("يبدأ لاحقاً", () => expect(discountState({ ...base, startsAt: "2026-10-10T00:00:00Z" }, NOW)).toBe("scheduled"));
});

describe("وصف الكود", () => {
  it("القيمة", () => {
    expect(discountValueLabel({ type: "percentage", value: 15 })).toBe("خصم 15%");
    expect(discountValueLabel({ type: "fixed", value: 5000 })).toBe("خصم 50 ج.م");
    expect(discountValueLabel({ type: "free_shipping", value: 0 })).toBe("شحن مجاني");
  });
  it("الشروط", () => {
    const c = discountConditions({ minSubtotalPiasters: 30000, perCustomerLimit: 1, maxUses: 100, startsAt: null, endsAt: null });
    expect(c).toEqual(["على طلب من 300 ج.م أو أكثر", "مرة واحدة لكل رقم موبايل", "لأول 100 طلب"]);
  });
  it("الكود المقترح بلا حروف ملتبسة", () => {
    for (let i = 0; i < 50; i++) expect(suggestCode()).toMatch(/^SAVE[A-HJ-NP-Z2-9]{4}$/);
  });
});
