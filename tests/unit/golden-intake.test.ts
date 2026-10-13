import { describe, expect, it } from "vitest";
import { completion, emptyIntake, validateSubmission, type IntakeData } from "@/intake/schema";
import { renderBrief } from "@/intake/brief";

const base = (): IntakeData => ({ ...emptyIntake(), offer: "golden", store: { name: "نور" }, contact: { email: "nour@gmail.com" } });
const item = (i: number, line = "فستان كتان، أسود، S M L، 850") => ({ id: `p${i}`, key: `key_${i}_abcdefgh`, line });

describe("Golden Circle mini intake", () => {
  it("requires real products (photo + line) and the launch video consent", () => {
    const e = validateSubmission(base());
    expect(e.products).toBeTruthy();
    expect(e["golden.video"]).toBeTruthy();
    const d = { ...base(), products: { mode: "list" as const, items: [item(1), item(2), { id: "p3", line: "بلا صورة" }] }, golden: { videoConsent: true } };
    expect(validateSubmission(d).products).toBeTruthy();
    const ok = { ...d, products: { mode: "list" as const, items: [item(1), item(2), item(3)] } };
    expect(validateSubmission(ok)).toEqual({});
  });
  it("regular intake is unaffected", () => {
    expect(validateSubmission({ ...emptyIntake(), store: { name: "نور" }, contact: { email: "nour@gmail.com" } })).toEqual({});
  });
  it("progress counts toward six products", () => {
    const d = { ...base(), social: { url: "@nour", teamCollects: false }, golden: { videoConsent: true }, products: { mode: "list" as const, items: [1, 2, 3, 4, 5, 6].map((i) => item(i)) } };
    expect(completion(d)).toBe(1);
    expect(completion({ ...d, products: { mode: "list" as const, items: [item(1), item(2), item(3)] } })).toBeCloseTo(0.9);
  });
  it("brief marks the offer for the team", () => {
    const b = renderBrief({ code: "REQ-1", data: { ...base(), golden: { videoConsent: true } }, assets: [] });
    expect(b).toContain("## العرض: الدائرة الذهبية");
    expect(b).toContain("وافق التاجر على تصويره");
  });
});
