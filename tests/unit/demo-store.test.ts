// متجر العرض (demo.colapia.com): علامته prefs.demo تجعل كل طلب فيه تجريبياً بلا بريد ولا خصم مخزون ولا سلات متروكة.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isDemoStore, isTestOrder } from "@/lib/demo-store";

describe("علامة متجر العرض", () => {
  it("القيمة المنطقية true وحدها", () => {
    expect(isDemoStore({ prefs: { demo: true } })).toBe(true);
    expect(isDemoStore({ prefs: { demo: "true" } })).toBe(false);
    expect(isDemoStore({ prefs: { demo: 1 } })).toBe(false);
    expect(isDemoStore({ prefs: {} })).toBe(false);
    expect(isDemoStore({ prefs: null })).toBe(false);
    expect(isDemoStore({ prefs: [true] })).toBe(false);
    expect(isDemoStore({})).toBe(false);
    expect(isDemoStore(null)).toBe(false);
    expect(isDemoStore(undefined)).toBe(false);
  });

  it("الطلب تجريبي في متجر العرض لأي زائر، وكما كان لمعاينة الفريق وصاحب المتجر", () => {
    expect(isTestOrder({ teamPreview: false, ownStore: false, demoStore: true })).toBe(true);
    expect(isTestOrder({ teamPreview: true, ownStore: false, demoStore: false })).toBe(true);
    expect(isTestOrder({ teamPreview: false, ownStore: true, demoStore: false })).toBe(true);
    expect(isTestOrder({ teamPreview: false, ownStore: false, demoStore: false })).toBe(false);
  });

  it("إتمام الطلب يستخدم القاعدة نفسها، ولا يحفظ سلات متروكة لمتجر العرض", () => {
    const src = readFileSync("src/server/actions/checkout.ts", "utf8");
    expect(src).toMatch(/const demoStore = isDemoStore\(store\);/);
    expect(src).toMatch(/const isTest = isTestOrder\(\{ teamPreview: teamPass, ownStore: [^}]+, demoStore \}\);/);
    // البريد للتاجر وحدث البكسل والنغمة كلها خلف !isTest.
    expect(src).toMatch(/if \(!isTest\) \{\s*after\(async \(\) => \{\s*try \{\s*const \[m\]/);
    expect(src).toMatch(/const pixelId = isTest \? null :/);
    expect(src).toMatch(/if \(!store \|\| isDemoStore\(store\)\) return;/);
  });

  it("صفحتا الدفع والطلب تقولان للزائر إنه متجر عرض", () => {
    expect(readFileSync("src/app/s/[store]/checkout/page.tsx", "utf8")).toContain("<b>متجر عرض:</b>");
    expect(readFileSync("src/app/s/[store]/order/[code]/page.tsx", "utf8")).toContain("طلب تجريبي في متجر العرض");
  });
});
