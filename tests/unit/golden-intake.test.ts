import { describe, expect, it } from "vitest";
import { completion, emptyIntake, validateSubmission, type IntakeData } from "@/intake/schema";
import { renderBrief } from "@/intake/brief";

const base = (): IntakeData => ({ ...emptyIntake(), offer: "golden", store: { name: "نور" }, contact: { email: "nour@gmail.com" } });
const item = (i: number, text = "فستان كتان، أسود، S M L، 850") => ({ id: `p${i}`, text, images: [`key_${i}_abcdefgh`] });

describe("Golden Circle mini intake", () => {
  it("requires three real products (text each; photos optional) and the launch video consent, but no payment or shipping", () => {
    const e = validateSubmission(base());
    expect(e.products).toBeTruthy();
    expect(e["golden.video"]).toBeTruthy();
    const two = { ...base(), products: { items: [item(1), item(2)] }, golden: { videoConsent: true } };
    expect(validateSubmission(two).products).toBeTruthy();
    // منتج بلا صور مقبول (الصور اختيارية)، لكن منتجاً بصور بلا كلام يُرفض في مكانه
    const noPhoto = { ...two, products: { items: [item(1), item(2), { id: "p3", text: "بلا صورة، 300", images: [] }] } };
    expect(validateSubmission(noPhoto)).toEqual({});
    const noText = { ...two, products: { items: [item(1), item(2), { id: "p3", text: "", images: ["key_3_abcdefgh"] }] } };
    expect(validateSubmission(noText)["products.p3"]).toBeTruthy();
    expect(validateSubmission({ ...two, products: { items: [item(1), item(2), item(3)] } })).toEqual({});
  });
  it("regular intake needs a product, a payment method and delivery", () => {
    const regular = { ...emptyIntake(), store: { name: "نور" }, contact: { email: "nour@gmail.com" } };
    expect(Object.keys(validateSubmission(regular))).toEqual(expect.arrayContaining(["products", "payment.methods", "delivery.scope", "delivery.fee"]));
  });
  it("progress counts toward six products", () => {
    const d = { ...base(), social: { url: "@nour" }, golden: { videoConsent: true }, products: { items: [1, 2, 3, 4, 5, 6].map((i) => item(i)) } };
    expect(completion(d)).toBe(1);
    expect(completion({ ...d, products: { items: [item(1), item(2), item(3)] } })).toBeCloseTo(0.9);
  });
  it("brief marks the offer for the team", () => {
    const b = renderBrief({ code: "REQ-1", data: { ...base(), golden: { videoConsent: true } }, assets: [] });
    expect(b).toContain("## العرض: الدائرة الذهبية");
    expect(b).toContain("وافق التاجر على تصويره");
  });
});
