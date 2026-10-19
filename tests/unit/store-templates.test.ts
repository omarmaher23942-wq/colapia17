import { describe, expect, it } from "vitest";
import { blueprintSchema } from "@/blueprint/schema";
import { defaultBlueprint } from "@/blueprint/defaults";
import { applyStarterTemplate, STARTER_TEMPLATES, TEMPLATE_IDS, templateForNiche } from "@/lib/store-templates";
import { NICHES } from "@/lib/niche-attributes";

const base = () => blueprintSchema.parse(defaultBlueprint({ name: "نور" }));

describe("قوالب البدء", () => {
  it("كل قالب ينتج Blueprint صالحاً بتصميمه الكامل", () => {
    for (const id of TEMPLATE_IDS) {
      const out = applyStarterTemplate(base(), id);
      expect(blueprintSchema.safeParse(out).success, id).toBe(true);
      expect(out.design.theme).toBe(STARTER_TEMPLATES[id].theme);
    }
  });

  it("لا يمس هوية التاجر ولا سياساته", () => {
    const b = base();
    const out = applyStarterTemplate(b, "fashion");
    expect(out.brand.name).toBe("نور");
    expect(out.payments).toEqual(b.payments);
    expect(out.shipping).toEqual(b.shipping);
    expect(out.returns).toEqual(b.returns);
    expect(out.channels).toEqual(b.channels);
  });

  it("لا يستبدل عنواناً كتبه التاجر", () => {
    const b = base();
    const home = b.home.map((s) => (s.type === "hero" ? { ...s, headline: "عنواني الخاص" } : s));
    const out = applyStarterTemplate({ ...b, home }, "shoes");
    expect(out.home.find((s) => s.type === "hero")).toMatchObject({ headline: "عنواني الخاص" });
  });

  it("لا يضيف خيار هدية ولا إلغاء ولا ادعاءات", () => {
    const out = applyStarterTemplate(base(), "beauty");
    expect(out.shipping.giftEnabled).toBeUndefined();
    expect(out.returns.allowCustomerCancel).toBe(false);
    const hero = out.home.find((s) => s.type === "hero") as { headline?: string; subheadline?: string };
    expect(`${hero.headline} ${hero.subheadline}`).not.toMatch(/الأفضل|الأول|مضمون|خصم/);
  });

  it("لكل نشاط قالب مقترح معروف", () => {
    for (const n of NICHES) expect(STARTER_TEMPLATES[templateForNiche(n)]).toBeTruthy();
    expect(templateForNiche("electronics")).toBe("electronics");
  });
});

describe("الخيارات الإضافية مغلقة افتراضياً", () => {
  it("متجر جديد: الهدية والإلغاء من الزبون مغلقان", () => {
    const b = base();
    expect(b.shipping.giftEnabled ?? false).toBe(false);
    expect(b.returns.allowCustomerCancel).toBe(false);
  });
});
