import { describe, expect, it } from "vitest";
import { MOBILE_NAV_HREFS, NAV_ITEMS, NAV_SECTIONS, navItemsFor, navSectionsFor } from "@/components/dashboard/nav";
import { areaForPath } from "@/lib/store-perms";
import { lockAllowsPath as lockAllowsPathCheck } from "@/lib/store-visibility";
import { OWNER_PERMS } from "@/lib/store-perms";

describe("قائمة لوحة التاجر (V3)", () => {
  it("المجموعات بالترتيب المعتمد", () => {
    expect(NAV_SECTIONS.map((s) => s.title)).toEqual(["اليوم", "الطلبات", "المنتجات", "العملاء", "التسويق", "المتجر وشكله", "الإعدادات والاشتراك"]);
  });
  it("كل رابط له مجال صلاحية وهو فريد", () => {
    const hrefs = NAV_ITEMS.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const h of hrefs) expect(areaForPath(h), h).not.toBeNull();
  });
  it("صفحات V3 كلها حاضرة", () => {
    const hrefs = NAV_ITEMS.map((i) => i.href);
    for (const h of ["/dashboard/design", "/dashboard/products/import", "/dashboard/billing", "/dashboard/returns", "/dashboard/questions", "/dashboard/studio"]) expect(hrefs).toContain(h);
  });
  it("الاستخدام مدمج في الاشتراك فلا بند مستقل له", () => {
    expect(NAV_ITEMS.some((i) => i.href === "/dashboard/usage")).toBe(false);
    expect(areaForPath("/dashboard/usage")).toBe("settings");
  });
  it("القفل لا يترك إلا الاشتراك، حتى لصاحب المتجر", () => {
    expect(navItemsFor(null, null, true).map((i) => i.href)).toEqual(["/dashboard/billing"]);
    expect(navItemsFor(OWNER_PERMS, null, true).map((i) => i.href)).toEqual(["/dashboard/billing"]);
    expect(navSectionsFor(null, null, true)).toHaveLength(1);
  });
  it("بلا قفل تظهر كل الصفحات", () => {
    expect(navItemsFor(null, null, false)).toHaveLength(NAV_ITEMS.length);
  });
  it("الشريط السفلي من صفحات موجودة", () => {
    for (const h of MOBILE_NAV_HREFS) expect(NAV_ITEMS.some((i) => i.href === h)).toBe(true);
  });
  it("الصفحات المفتوحة أثناء القفل هي ما يعرضه الخادم", () => {
    expect(lockAllowsPathCheck("/dashboard/billing")).toBe(true);
    expect(lockAllowsPathCheck("/dashboard/orders")).toBe(false);
  });
});
