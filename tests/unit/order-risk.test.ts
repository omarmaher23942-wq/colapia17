import { describe, expect, it } from "vitest";
import { looksFakeName, looksFakePhone, looksVagueAddress, orderRisk, type RiskInput } from "@/lib/order-risk";

const base: RiskInput = {
  paymentMethod: "cod",
  totalPiasters: 45000,
  customerName: "سارة محمود",
  customerPhone: "01093827461",
  address: "12 شارع النصر، الدور الثالث",
  history: { total: 0, delivered: 0, returned: 0, cancelled: 0 },
  recentOpen: 0,
  avgDeliveredPiasters: 40000,
};

describe("order risk", () => {
  it("a normal first order has no signals", () => {
    expect(orderRisk(base)).toEqual({ level: "none", score: 0, reasons: [] });
  });

  it("repeat customers with deliveries and no returns are trusted", () => {
    const r = orderRisk({ ...base, history: { total: 3, delivered: 3, returned: 0, cancelled: 0 } });
    expect(r.level).toBe("trusted");
  });

  it("a past refusal at delivery is high risk when it outweighs deliveries", () => {
    const r = orderRisk({ ...base, history: { total: 1, delivered: 0, returned: 1, cancelled: 0 } });
    expect(r.level).toBe("medium");
    expect(orderRisk({ ...base, history: { total: 2, delivered: 0, returned: 2, cancelled: 0 }, recentOpen: 1 }).level).toBe("high");
    expect(orderRisk({ ...base, history: { total: 5, delivered: 4, returned: 1, cancelled: 0 } }).level).toBe("medium");
  });

  it("flags duplicates, fake phones, vague addresses and unusually large first orders", () => {
    expect(orderRisk({ ...base, recentOpen: 1 }).reasons[0]).toContain("24 ساعة");
    expect(orderRisk({ ...base, customerPhone: "01111111111" }).level).toBe("medium");
    expect(orderRisk({ ...base, address: "المعادي" }).level).toBe("low");
    expect(orderRisk({ ...base, totalPiasters: 200000 }).level).toBe("medium");
    // بلا متوسط معروف (أقل من 5 طلبات مسلّمة) لا نحكم على القيمة
    expect(orderRisk({ ...base, totalPiasters: 200000, avgDeliveredPiasters: null }).level).toBe("none");
  });

  it("prepaid orders carry half the weight", () => {
    expect(orderRisk({ ...base, paymentMethod: "instapay", recentOpen: 1 }).level).toBe("low");
  });

  it("heuristics", () => {
    expect(looksFakePhone("01234567890")).toBe(false);
    expect(looksFakePhone("0100123")).toBe(true);
    expect(looksFakePhone("01099999999")).toBe(true);
    expect(looksFakeName("مم")).toBe(true);
    expect(looksFakeName("أحمد 2")).toBe(true);
    expect(looksFakeName("أحمد علي")).toBe(false);
    expect(looksVagueAddress("مدينة نصر")).toBe(true);
    expect(looksVagueAddress("15 ش عباس العقاد")).toBe(false);
  });
});
