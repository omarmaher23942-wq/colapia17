import { describe, expect, it } from "vitest";
import { qualityTips, type QualityFacts } from "@/lib/store-quality";
import { commerceQuestions } from "@/lib/onboarding";

const good: QualityFacts = { hasLogo: true, activeProducts: 12, withoutImage: 0, withoutDescription: 0, categories: 4, usesSizes: false, sizeGuideCharts: 0 };

describe("اقتراحات جودة المتجر", () => {
  it("متجر مكتمل: لا اقتراحات", () => {
    expect(qualityTips(good)).toEqual([]);
  });
  it("يذكر ما نقص فعلاً فقط، بترتيب الأهم", () => {
    const t = qualityTips({ ...good, withoutImage: 3, hasLogo: false, activeProducts: 3 });
    expect(t.map((x) => x.id)).toEqual(["images", "count", "logo"]);
    expect(t[0]!.text).toContain("3");
  });
  it("دليل المقاسات يُقترح لنشاط المقاسات بلا جدول فقط", () => {
    expect(qualityTips({ ...good, usesSizes: true }).map((x) => x.id)).toContain("size");
    expect(qualityTips({ ...good, usesSizes: true, sizeGuideCharts: 1 })).toEqual([]);
  });
  it("حد أقصى 4", () => {
    const t = qualityTips({ hasLogo: false, activeProducts: 2, withoutImage: 1, withoutDescription: 1, categories: 20, usesSizes: true, sizeGuideCharts: 0 });
    expect(t.length).toBe(4);
  });
});

describe("أسئلة الدفع والشحن", () => {
  it("المعاينة تُسأل مع الدفع عند الاستلام فقط", () => {
    expect(commerceQuestions(true)).toContain("inspection");
    expect(commerceQuestions(false)).not.toContain("inspection");
  });
  it("الخيارات الإضافية تأتي بعد الأساسيات وبصيغة سؤال مستقل", () => {
    const q = commerceQuestions(true);
    expect(q.indexOf("gift")).toBeGreaterThan(q.indexOf("returns"));
    expect(q.indexOf("cancel")).toBeGreaterThan(q.indexOf("gift"));
    expect(q[q.length - 1]).toBe("discount");
  });
});
