import { describe, expect, it } from "vitest";
import { SIZE_TEMPLATES, chartFor, canRecommend, recommendSize, sizeGuideSchema, type SizeChart } from "@/lib/size-guide";

const tops = { id: "a", ...SIZE_TEMPLATES[0]!.chart } as SizeChart;

describe("مساعد المقاس", () => {
  it("يقترح المقاس الداخل في المديين", () => {
    expect(recommendSize(tops, { height: 168, weight: 66 })).toEqual({ size: "M", exact: true, alternative: null });
  });
  it("بين مقاسين: الأقرب مع البديل في اتجاه العميل", () => {
    const r = recommendSize(tops, { height: 172, weight: 79 });
    expect(r?.size).toBe("L");
    expect(recommendSize(tops, { height: 179, weight: 76 })?.exact).toBe(false);
  });
  it("مريح يرفع مقاساً، وبلا بيانات لا اقتراح", () => {
    expect(recommendSize(tops, { height: 168, weight: 66, fit: "loose" })?.size).toBe("L");
    expect(recommendSize(tops, {})).toBeNull();
    const shoes = { id: "s", ...SIZE_TEMPLATES[3]!.chart } as SizeChart;
    expect(canRecommend(shoes)).toBe(false);
    expect(recommendSize(shoes, { height: 170 })).toBeNull();
  });
  it("الجدول المناسب: القسم أولاً، ولا جدول لمنتج بلا خيار مقاس", () => {
    const guide = sizeGuideSchema.parse({ charts: [tops, { ...tops, id: "b", name: "قسم", appliesTo: ["cat1"] }] });
    expect(chartFor(guide, "cat1", ["المقاس", "اللون"])?.id).toBe("b");
    expect(chartFor(guide, "cat2", ["Size"])?.id).toBe("a");
    expect(chartFor(guide, "cat1", ["اللون"])).toBeNull();
    expect(chartFor(undefined, null, ["المقاس"])).toBeNull();
  });
  it("المخطط يقبل الأرقام النصية والفارغ", () => {
    const g = sizeGuideSchema.parse({ charts: [{ id: "x", name: "ج", rows: [{ size: "M", heightFrom: "160", heightTo: "", weightFrom: null }] }] });
    expect(g.charts[0]!.rows[0]).toMatchObject({ heightFrom: 160, heightTo: null });
  });
});

describe("رسالة «رجع تاني»", async () => {
  const { restockMessage } = await import("@/lib/order-messages");
  it("فيها الاسم الأول والاختيار والرابط", () => {
    const m = restockMessage({ name: "منى أحمد", variantLabel: "M / بيج" }, { name: "فستان", url: "https://x.colapia.com/p/a" }, "نوفا");
    expect(m).toContain("أهلاً منى،");
    expect(m).toContain("فستان (M / بيج)");
    expect(m).toContain("https://x.colapia.com/p/a");
  });
});
