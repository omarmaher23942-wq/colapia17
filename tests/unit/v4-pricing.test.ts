import { describe, expect, it } from "vitest";
import { DEFAULT_PRICING, editTerms, freeEditDeadline, projectQuote, validatePricing } from "@/lib/platform-pricing";
import { safeUrl } from "@/lib/safe-url";

describe("تسعير المشاريع", () => {
  it("الذهبية 999 والمقعد الأول محجوز، وبعد النفاد 4,999 بلا ذهبية", () => {
    expect(projectQuote(DEFAULT_PRICING, 0)).toMatchObject({ offer: "golden", price: 999, seatsLeft: 9 });
    expect(projectQuote(DEFAULT_PRICING, 9)).toMatchObject({ offer: "standard", price: 4999, seatsLeft: 0 });
  });
  it("التعديل: مجاني مرة داخل 7 أيام ثم 999", () => {
    const d = new Date("2026-10-01T00:00:00Z");
    const until = freeEditDeadline(d, 7);
    const now = new Date("2026-10-03T00:00:00Z");
    expect(editTerms(DEFAULT_PRICING, { deliveredAt: d, freeEditUntil: until, freeUsed: false, now })).toMatchObject({ ok: true, free: true });
    expect(editTerms(DEFAULT_PRICING, { deliveredAt: d, freeEditUntil: until, freeUsed: true, now })).toMatchObject({ free: false, fee: 999, reason: "free_used" });
    expect(editTerms(DEFAULT_PRICING, { deliveredAt: d, freeEditUntil: until, freeUsed: false, now: new Date("2026-10-20T00:00:00Z") })).toMatchObject({ free: false, reason: "window_closed" });
    expect(editTerms(DEFAULT_PRICING, { deliveredAt: null, freeEditUntil: null, freeUsed: false, now }).ok).toBe(false);
  });
  it("التحقق يرفض مدخلاً غير صالح", () => {
    expect(validatePricing(null).ok).toBe(false);
  });
});

describe("safeUrl", () => {
  it("https فقط", () => {
    expect(safeUrl("https://github.com/a/b")).toBeTruthy();
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("http://x.com")).toBeNull();
  });
});
