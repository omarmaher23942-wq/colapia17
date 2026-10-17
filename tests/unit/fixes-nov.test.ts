import { describe, expect, it } from "vitest";
import { groundedText, storeFacts } from "@/blueprint/facts";
import { defaultBlueprint } from "@/blueprint/defaults";
import { blueprintSchema } from "@/blueprint/schema";

describe("truthful free text", () => {
  const bp = blueprintSchema.parse(defaultBlueprint({ name: "ميادة فاشون" } as never));
  it("drops a false nationwide clause and keeps the rest of the sentence", () => {
    const facts = storeFacts({ ...bp, payments: { ...bp.payments, cod: { ...bp.payments.cod, enabled: true } } }, { activeGovernorates: 5 });
    expect(groundedText("تسوق من ميادة فاشون أونلاين بالدفع عند الاستلام وشحن لكل محافظات مصر.", facts)).toBe(
      "تسوق من ميادة فاشون أونلاين بالدفع عند الاستلام."
    );
  });
  it("keeps true claims and plain sentences untouched", () => {
    const facts = storeFacts(bp, { activeGovernorates: 27 });
    const t = "أزياء مختارة بعناية. شحن لكل محافظات مصر.";
    expect(groundedText(t, facts)).toBe(t);
  });
  it("removes a whole sentence that is only a false claim", () => {
    const facts = storeFacts({ ...bp, shipping: { ...bp.shipping, inspectionAllowed: false } }, { activeGovernorates: 3 });
    expect(groundedText("قطع مريحة للصيف. معاينة قبل الدفع.", facts)).toBe("قطع مريحة للصيف.");
  });
});
