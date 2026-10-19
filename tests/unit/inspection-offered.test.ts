import { describe, it, expect } from "vitest";
import { inspectionOffered, storeFacts } from "@/blueprint/facts";
import { defaultBlueprint } from "@/blueprint/defaults";

// المعاينة قبل الدفع تتحقق عند الاستلام فقط: لا تُوعد بها المتاجر التي أغلقت الدفع عند الاستلام.
const make = (inspection: boolean, cod: boolean) => {
  const bp = defaultBlueprint({ name: "متجر", inspectionAllowed: inspection } as never);
  bp.shipping.inspectionAllowed = inspection;
  bp.payments.cod.enabled = cod;
  return bp;
};

describe("inspectionOffered", () => {
  it("تُعرض فقط حين تسمح بها السياسة والدفع عند الاستلام مفعّل", () => {
    expect(inspectionOffered(make(true, true))).toBe(true);
    expect(inspectionOffered(make(true, false))).toBe(false);
    expect(inspectionOffered(make(false, true))).toBe(false);
  });
  it("لا تظهر في حقائق المتجر بلا دفع عند الاستلام", () => {
    expect(storeFacts(make(true, false)).some((f) => f.key === "inspection")).toBe(false);
    expect(storeFacts(make(true, true)).some((f) => f.key === "inspection")).toBe(true);
  });
});
