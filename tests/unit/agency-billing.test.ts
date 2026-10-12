import { describe, expect, it } from "vitest";
import { DEFAULT_LADDER, ladderFrom, normalizeCoupon, priceAt } from "@/lib/platform-pricing";
import { timingsFrom, trialSchedule } from "@/lifecycle/timings-rules";

describe("سلّم الأسعار", () => {
  it("الافتراضي سعر واحد 2,499 بلا حد ولا سعر مشطوب، وتجديد 1,299، والدائرة الذهبية GOLDEN599 لـ5", () => {
    expect(priceAt(0, DEFAULT_LADDER)).toEqual({ price: 2499, tier: 0, remaining: null, nextPrice: null });
    expect(DEFAULT_LADDER.basePrice).toBe(2499);
    expect(DEFAULT_LADDER.renewal).toBe(1299);
    expect(DEFAULT_LADDER.golden).toEqual({ code: "GOLDEN599", price: 599, seats: 5 });
    expect(normalizeCoupon(" golden ٥٩٩ ")).toBe("GOLDEN599");
    expect(ladderFrom({ golden: { code: "x", price: -1, seats: 2 } }).golden).toEqual({ code: "GOLDEN599", price: 599, seats: 2 });
  });
  it("سلّم مراحل يضبطه المالك: 2499 ثم 3499 ثم 4999، والعدّاد حقيقي", () => {
    const LADDER = ladderFrom({ tiers: [{ upTo: 5, price: 2499 }, { upTo: 15, price: 3499 }, { upTo: null, price: 4999 }] });
    expect(priceAt(0, LADDER)).toEqual({ price: 2499, tier: 0, remaining: 5, nextPrice: 3499 });
    expect(priceAt(4, LADDER)).toMatchObject({ price: 2499, remaining: 1 });
    expect(priceAt(5, LADDER)).toMatchObject({ price: 3499, remaining: 10, nextPrice: 4999 });
    expect(priceAt(15, LADDER)).toMatchObject({ price: 4999, remaining: null, nextPrice: null });
    expect(priceAt(500, LADDER).price).toBe(4999);
  });
  it("إعداد تالف أو فارغ = السلّم الافتراضي", () => {
    expect(ladderFrom(null)).toEqual(DEFAULT_LADDER);
    expect(ladderFrom({ tiers: "x" })).toEqual(DEFAULT_LADDER);
  });
  it("يتجاهل المراحل غير التصاعدية ويضيف مرحلة أخيرة بلا حد، والسعر «قبل» لا يقل عن الأعلى", () => {
    const l = ladderFrom({ tiers: [{ upTo: 3, price: 1000 }, { upTo: 2, price: 1500 }, { upTo: 10, price: 2000 }], basePrice: 500, renewal: 900 });
    expect(l.tiers).toEqual([{ upTo: 3, price: 1000 }, { upTo: 10, price: 2000 }, { upTo: null, price: 2000 }]);
    expect(l.basePrice).toBe(2000);
    expect(l.renewal).toBe(900);
  });
});

describe("مدد ما بعد التسليم", () => {
  it("الافتراضي 24/24/24 والقيم الشاذة تُرفض", () => {
    expect(timingsFrom(null)).toEqual({ trialHours: 24, noticeHours: 24, deleteHours: 24 });
    expect(timingsFrom({ trialHours: 0, noticeHours: 99999, deleteHours: 12 })).toEqual({ trialHours: 24, noticeHours: 24, deleteHours: 12 });
  });
  it("المواعيد: أفكار في المنتصف، دفع قبل النهاية بساعتين، إيقاف، تنبيه أخير، حذف (72 ساعة افتراضياً)", () => {
    const d = new Date("2026-01-01T00:00:00Z");
    const s = trialSchedule(d, timingsFrom(null));
    const h = (x: Date) => (x.getTime() - d.getTime()) / 3_600_000;
    expect([h(s.ideas), h(s.pay), h(s.freeze), h(s.lastChance), h(s.purge)]).toEqual([12, 22, 24, 48, 72]);
    const short = trialSchedule(d, { trialHours: 2, noticeHours: 1, deleteHours: 1 });
    expect(h(short.ideas)).toBe(1);
    expect(h(short.pay)).toBeGreaterThan(h(short.ideas));
    expect(h(short.purge)).toBe(4);
  });
});
