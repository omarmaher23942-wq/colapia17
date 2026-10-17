import { describe, expect, it } from "vitest";
import { governoratesIn, parseEtaDays } from "@/agency/policies";

describe("المحافظات من كلام التاجر", () => {
  it("أسماء صريحة بأي إملاء، مع واو لاصقة", () => {
    expect(governoratesIn("القاهرة والجيزة والإسكندرية")).toEqual(["cairo", "giza", "alexandria"]);
    expect(governoratesIn("اسكندرية، المنصورة؟ الدقهلية")).toEqual(["alexandria", "dakahlia"]);
    expect(governoratesIn("بورسعيد و بني سويف")).toEqual(["port_said", "beni_suef"]);
  });
  it("مجموعات: القاهرة الكبرى، الصعيد، الدلتا، سيناء", () => {
    expect(governoratesIn("القاهرة الكبرى")).toEqual(["cairo", "giza", "qalyubia"]);
    expect(governoratesIn("الصعيد")).toEqual(["faiyum", "beni_suef", "minya", "asyut", "sohag", "qena", "luxor", "aswan"]);
    expect(governoratesIn("الدلتا وسيناء")).toEqual(expect.arrayContaining(["gharbia", "north_sinai", "south_sinai"]));
  });
  it("لا شيء مفهوم = قائمة فارغة", () => {
    expect(governoratesIn("")).toEqual([]);
    expect(governoratesIn("أي مكان بنقدر")).toEqual([]);
  });
});

describe("مدة التوصيل", () => {
  it("نطاق أو يوم محدد أو لا شيء", () => {
    expect(parseEtaDays("من 2 إلى 4 أيام")).toEqual({ min: 2, max: 4 });
    expect(parseEtaDays("٣-٥ أيام")).toEqual({ min: 3, max: 5 });
    expect(parseEtaDays("5 أيام عمل")).toEqual({ min: 5, max: 5 });
    expect(parseEtaDays("يومين")).toEqual({ min: 2, max: 2 });
    expect(parseEtaDays("حسب الطلب")).toBeNull();
    expect(parseEtaDays(undefined)).toBeNull();
  });
});
