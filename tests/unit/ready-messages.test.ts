import { describe, expect, it } from "vitest";
import { readyMessages } from "@/lib/ready-messages";

describe("readyMessages", () => {
  it("يعيد خمس رسائل بمفاتيح فريدة", () => {
    const m = readyMessages("نور", "https://nour.colapia.com");
    expect(m.map((x) => x.key)).toEqual(["confirm", "shipped", "review", "stock", "delay"]);
  });
  it("يذكر اسم المتجر ورابطه بلا بروتوكول", () => {
    const m = readyMessages("نور", "https://nour.colapia.com");
    expect(m[0]!.text).toContain("نور");
    const review = m.find((x) => x.key === "review")!.text;
    expect(review).toContain("nour.colapia.com");
    expect(review).not.toContain("https://");
  });
  it("بلا رابط لا يترك أسطراً فارغة ويستخدم اسماً بديلاً", () => {
    const m = readyMessages("  ", null);
    for (const x of m) expect(x.text).not.toMatch(/\n\n\n|\s$/);
    expect(m[0]!.text).toContain("متجرنا");
  });
  it("لا صيغ أمر لجنس واحد", () => {
    const all = readyMessages("نور").map((m) => m.text).join(" ");
    expect(all).not.toMatch(/(^|\s)(دوّري|جرّبي|اختاري|تعالي|قولي)(\s|$)/);
  });
});
