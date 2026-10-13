import { describe, expect, it } from "vitest";
import { chatSourceLabel, findGovernorate, manualSource, parseChatDetails } from "@/lib/manual-order";

describe("findGovernorate", () => {
  it("matches names, aliases and districts", () => {
    expect(findGovernorate("ساكن في مدينة نصر")).toBe("cairo");
    expect(findGovernorate("اسكندريه سموحة")).toBe("alexandria");
    expect(findGovernorate("الشيخ زايد الحي 7")).toBe("giza");
    expect(findGovernorate("شمال سيناء العريش")).toBe("north_sinai");
    expect(findGovernorate("لا شيء هنا")).toBeNull();
  });
});

describe("parseChatDetails", () => {
  it("reads a labelled message", () => {
    const d = parseChatDetails("الاسم: منى أحمد\nرقم: ٠١٠٢٣٤٥٦٧٨٩\nالعنوان: 12 شارع التحرير، الدقي، الجيزة\nرقم تاني 01123456789");
    expect(d).toEqual({ phone: "01023456789", altPhone: "01123456789", governorate: "giza", name: "منى أحمد", address: "12 شارع التحرير، الدقي، الجيزة" });
  });

  it("reads an unlabelled message", () => {
    const d = parseChatDetails("كريم سمير\n+20 115 555 4444\nالمنصورة، شارع الجمهورية عمارة 5 الدور 3");
    expect(d.phone).toBe("01155554444");
    expect(d.name).toBe("كريم سمير");
    expect(d.governorate).toBe("dakahlia");
    expect(d.address).toContain("شارع الجمهورية");
  });

  it("does not invent what is missing", () => {
    expect(parseChatDetails("عايز المقاس L لو سمحت")).toMatchObject({ phone: null, governorate: null, address: null });
  });
});

describe("chat source", () => {
  it("labels manual sources only", () => {
    expect(chatSourceLabel(manualSource("instagram"))).toBe("إنستجرام");
    expect(chatSourceLabel("chat:xyz")).toBe("مصدر آخر");
    expect(chatSourceLabel("storefront")).toBeNull();
  });
});
