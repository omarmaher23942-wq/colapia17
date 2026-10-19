import { describe, expect, it } from "vitest";
import { codAmountEgp, courierFromName, courierTable, trackingUrl, COURIERS, COURIER_INFO, type ShipOrder } from "@/lib/courier-export";
import { aggregatePick } from "@/lib/pick-list";
import { reconcileCod, SETTLED_TAG } from "@/lib/cod-reconcile";
import { planBulkEdit, type BulkRow } from "@/lib/bulk-edit";
import { goalPace, monthKey, netProfit, readGoalPrefs, roas, weeklyRecommendations, withAdSpend, withGoal } from "@/lib/sales-goal";
import { meter, nextResetLabel, storePlanId, upgradeFor, upgradeHint } from "@/lib/usage-limits";
import { DEFAULT_PRICING } from "@/lib/platform-pricing";

const order = (over: Partial<ShipOrder> = {}): ShipOrder => ({
  code: "CLP-1",
  customerName: "منى أحمد",
  customerPhone: "01012345678",
  governorate: "cairo",
  address: "شارع 9",
  paymentMethod: "cod",
  paymentStatus: "pending",
  totalPiasters: 45000,
  paidPiasters: 5000,
  items: [{ name: "قميص", variant: "M", qty: 2 }],
  ...over,
});

describe("تصدير شركات الشحن", () => {
  it("مبلغ التحصيل = الإجمالي ناقص المدفوع للاستلام فقط", () => {
    expect(codAmountEgp(order())).toBe(400);
    expect(codAmountEgp(order({ paymentMethod: "vodafone_cash", paymentStatus: "confirmed" }))).toBe(0);
    expect(codAmountEgp(order({ paidPiasters: 90000 }))).toBe(0);
  });
  it("كل شركة صف بعدد أعمدة العناوين", () => {
    for (const k of COURIERS) {
      const t = courierTable(k, [order()]);
      expect(t.rows[0]).toHaveLength(t.headers.length);
    }
  });
  it("بوسطة تضع التحصيل في عمود COD", () => {
    const t = courierTable("bosta", [order()]);
    expect(t.rows[0]![t.headers.indexOf("COD")]).toBe(400);
  });
  it("يتعرف على الشركة ويبني رابط التتبع", () => {
    expect(courierFromName("Bosta")).toBe("bosta");
    expect(courierFromName("J&T Express")).toBe("jt");
    expect(courierFromName("مندوب خاص")).toBe("private");
    expect(trackingUrl("بوسطة", "123 456")).toContain("123%20456");
    expect(trackingUrl("مندوب خاص", "1")).toBeNull();
    expect(trackingUrl("بوسطة", "")).toBeNull();
    expect(COURIER_INFO.aramex.trackingTemplate).toContain("{n}");
  });
});

describe("قائمة التجهيز", () => {
  it("تجمع القطعة بمقاسها عبر الطلبات", () => {
    const l = aggregatePick([
      { orderId: "a", orderCode: "A", productId: "p", name: "قميص", variant: "M", image: null, qty: 2 },
      { orderId: "b", orderCode: "B", productId: "p", name: "قميص", variant: "M", image: "x", qty: 1 },
      { orderId: "b", orderCode: "B", productId: "p", name: "قميص", variant: "L", image: null, qty: 1 },
    ]);
    expect(l[0]).toMatchObject({ variant: "M", qty: 3, image: "x" });
    expect(l[0]!.orders).toHaveLength(2);
    expect(l).toHaveLength(2);
  });
});

describe("تسوية التحصيل", () => {
  it("تفصل المسدد عن المعلق لكل شركة", () => {
    const base = { courierName: "بوسطة", status: "delivered", deliveredAt: null };
    const g = reconcileCod([
      { id: "1", code: "1", collectPiasters: 10000, tags: [SETTLED_TAG], ...base },
      { id: "2", code: "2", collectPiasters: 20000, tags: [], ...base },
      { id: "3", code: "3", collectPiasters: 0, tags: [], ...base },
      { id: "4", code: "4", collectPiasters: 5000, tags: [], ...base, status: "shipped" },
    ]);
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ deliveredPiasters: 30000, settledPiasters: 10000, pendingPiasters: 20000 });
  });
});

describe("التعديل الجماعي", () => {
  const row = (o: Partial<BulkRow> = {}): BulkRow => ({ id: "p1", name: "ق", price: "100", compareAt: "", stock: "5", status: "active", variants: [], ...o });
  it("يتجاهل الصفوف غير المعدلة", () => {
    expect(planBulkEdit([row()], [row()]).patches).toHaveLength(0);
  });
  it("يحوّل الجنيه إلى قروش ويقبل الأرقام العربية", () => {
    const r = planBulkEdit([row()], [row({ price: "١٢٠٫٥", compareAt: "200" })]);
    expect(r.issues).toHaveLength(0);
    expect(r.patches[0]).toMatchObject({ pricePiasters: 12050, compareAtPiasters: 20000 });
  });
  it("يرفض سعراً صفرياً وقبل خصم أقل من البيع ومخزوناً كسرياً", () => {
    const r = planBulkEdit([row()], [row({ price: "0", stock: "1.5" })]);
    expect(r.issues.map((i) => i.field).sort()).toEqual(["price", "stock"]);
    expect(planBulkEdit([row()], [row({ compareAt: "50" })]).issues[0]?.field).toBe("compareAt");
    expect(planBulkEdit([row()], [row({ compareAt: "50" })]).patches).toHaveLength(0);
  });
  it("مخزون فارغ = غير محدود، والتركيبات لا تمس مخزون المنتج", () => {
    expect(planBulkEdit([row()], [row({ stock: "" })]).patches[0]!.stock).toBeNull();
    const v = [{ id: "v1", label: "M", stock: "3", price: "" }];
    const r = planBulkEdit([row({ variants: v })], [row({ variants: [{ ...v[0]!, stock: "9" }] })]);
    expect(r.patches[0]!.stock).toBeUndefined();
    expect(r.patches[0]!.variants[0]).toMatchObject({ stock: 9, pricePiasters: null });
  });
});

describe("هدف المبيعات وصافي الربح", () => {
  it("وتيرة الشهر", () => {
    expect(goalPace({ goalEgp: null, soldPiasters: 5, dayOfMonth: 5, daysInMonth: 30 }).status).toBe("none");
    expect(goalPace({ goalEgp: 1000, soldPiasters: 100000, dayOfMonth: 10, daysInMonth: 30 }).status).toBe("reached");
    expect(goalPace({ goalEgp: 3000, soldPiasters: 150000, dayOfMonth: 10, daysInMonth: 30 }).status).toBe("ahead");
    expect(goalPace({ goalEgp: 3000, soldPiasters: 100000, dayOfMonth: 10, daysInMonth: 30 }).status).toBe("on_track");
    const behind = goalPace({ goalEgp: 3000, soldPiasters: 30000, dayOfMonth: 10, daysInMonth: 30 });
    expect(behind.status).toBe("behind");
    expect(behind.perDayNeededPiasters).toBe(Math.ceil((300000 - 30000) / 20));
  });
  it("الصافي وROAS", () => {
    expect(netProfit(100000, 300)).toBe(70000);
    expect(netProfit(null, 300)).toBeNull();
    expect(roas(500000, 1000)).toBe(5);
    expect(roas(500000, 0)).toBeNull();
  });
  it("prefs تُقرأ وتُدمج بأمان", () => {
    expect(readGoalPrefs({ monthlyGoalEgp: -4, adSpend: { "2026-10": 500, bad: 3, "2026-09": "x" } })).toEqual({ monthlyGoalEgp: null, adSpend: { "2026-10": 500 } });
    const p = withAdSpend(withGoal({ keep: 1 }, 20000), "2026-10", 750);
    expect(p).toMatchObject({ keep: 1, monthlyGoalEgp: 20000, adSpend: { "2026-10": 750 } });
    expect(withAdSpend(p, "2026-10", 0).adSpend).toEqual({});
    expect(monthKey(new Date("2026-10-17T10:00:00Z"))).toBe("2026-10");
  });
  it("توصيات أسبوعية صادقة", () => {
    const none = weeklyRecommendations({ viewedNotBought: null, lowSizes: [], topSource: null, quietDays: 0 });
    expect(none).toHaveLength(0);
    const r = weeklyRecommendations({ viewedNotBought: { name: "ق", viewers: 9 }, lowSizes: [{ product: "ق", label: "M", stock: 2 }], topSource: { source: "إنستجرام", orders: 5, share: 60 }, quietDays: 0 });
    expect(r.map((x) => x.key)).toEqual(["viewed", "sizes", "source"]);
  });
});

describe("حدود الاستخدام", () => {
  it("باقة المتجر: المدفوع بباقته، والقديم بلا باقة معروفة = النمو، وغير المدفوع بحدود التجربة (النمو)", () => {
    expect(storePlanId({ status: "active", plan: "pro" })).toEqual({ planId: "pro", isTrial: false });
    expect(storePlanId({ status: "active", plan: "golden" })).toEqual({ planId: "growth", isTrial: false });
    expect(storePlanId({ status: "active", plan: "launch", prefs: { planId: "basic" } })).toEqual({ planId: "basic", isTrial: false });
    expect(storePlanId({ status: "trial", plan: "basic" })).toEqual({ planId: "growth", isTrial: true });
    expect(storePlanId({ status: "frozen" }).isTrial).toBe(true);
  });
  it("تلميح الترقية: أول باقة أعلى تتيح أكثر، ولا تلميح في الأعلى", () => {
    expect(upgradeFor(DEFAULT_PRICING, "basic", "products")?.id).toBe("growth");
    expect(upgradeFor(DEFAULT_PRICING, "basic", "customDomain")?.id).toBe("growth");
    expect(upgradeFor(DEFAULT_PRICING, "pro", "products")).toBeNull();
    expect(upgradeHint(DEFAULT_PRICING, "basic", "products")).toContain("2,000");
    expect(upgradeHint(DEFAULT_PRICING, "pro", "aiPerMonth")).toBe("");
  });
  it("العدّاد ودرجة اللون", () => {
    expect(meter(50, 100).tone).toBe("ok");
    expect(meter(85, 100).tone).toBe("warn");
    expect(meter(120, 100)).toMatchObject({ pct: 100, tone: "bad", remaining: 0 });
  });
  it("تاريخ التجدد", () => {
    expect(nextResetLabel(new Date("2026-10-17T10:00:00Z"))).toBe("1 نوفمبر");
    expect(nextResetLabel(new Date("2026-12-17T10:00:00Z"))).toBe("1 يناير");
  });
});

import { canMoveReturn, creditFor, returnMessage } from "@/lib/returns";
import { allowedNumbers, filterHonest, isHonest, type StudioFacts } from "@/lib/studio";

describe("طابور الاستبدال", () => {
  it("الانتقالات المسموحة فقط", () => {
    expect(canMoveReturn("new", "approved")).toBe(true);
    expect(canMoveReturn("new", "received")).toBe(false);
    expect(canMoveReturn("received", "completed")).toBe(true);
    expect(canMoveReturn("rejected", "approved")).toBe(false);
  });
  it("رصيد الاستبدال لا يتجاوز الكمية المطلوبة", () => {
    expect(creditFor([{ unitPiasters: 10000, quantity: 2 }], [{ index: 0, qty: 5 }])).toBe(20000);
    expect(creditFor([{ unitPiasters: 10000, quantity: 2 }], [{ index: 3, qty: 1 }])).toBe(0);
  });
  it("الرسائل بصيغة الجمع بلا عامية", () => {
    const m = returnMessage("approved", { name: "منى أحمد", code: "CLP-1", storeName: "متجر", kind: "exchange" });
    expect(m).toContain("وافقنا");
    expect(m).not.toMatch(/ابعت|هنرد/);
  });
});

describe("استوديو المحتوى: فلتر الصدق", () => {
  const facts: StudioFacts = { storeName: "متجر", niche: null, facts: ["شحن لـ 27 محافظة"], url: "x.colapia.com", products: [{ id: "1", name: "قميص", priceEgp: 350, compareAtEgp: null, shortDescription: null, category: null, tags: [] }] };
  const allowed = allowedNumbers(facts);
  it("يقبل الأسعار والحقائق الموجودة ويرفض المخترعة", () => {
    expect(isHonest("قميص بـ ٣٥٠ جنيه", allowed)).toBe(true);
    expect(isHonest("خصم 50% لفترة محدودة", allowed)).toBe(false);
    expect(isHonest("نشحن لـ 27 محافظة", allowed)).toBe(true);
    expect(isHonest("كُتب بواسطة ذكاء اصطناعي", allowed)).toBe(false);
  });
  it("يصفّي العناصر غير الصادقة", () => {
    expect(filterHonest([{ text: "قميص 350" }, { text: "خصم 70" }], allowed)).toHaveLength(1);
  });
});
