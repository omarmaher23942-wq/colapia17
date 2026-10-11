import { describe, expect, it } from "vitest";
import { allows, areaForPath, firstAllowedArea, NO_PERMS, OWNER_PERMS, permsFor, STORE_ROLE_INFO } from "@/lib/store-perms";

describe("صلاحيات فريق التاجر", () => {
  it("صاحب المتجر كل شيء، والمستويات متدرجة", () => {
    expect(allows(OWNER_PERMS, "billing", "manage")).toBe(true);
    const p = permsFor("orders");
    expect(allows(p, "orders", "manage")).toBe(true);
    expect(allows(p, "customers", "view")).toBe(true);
    expect(allows(p, "customers", "manage")).toBe(false);
    expect(allows(p, "settings", "view")).toBe(false);
  });
  it("لا دور جاهز يمنح الفريق أو الاشتراك، ولا المخصص", () => {
    for (const r of Object.values(STORE_ROLE_INFO)) {
      expect(r.perms.team).toBe("none");
      expect(r.perms.billing).toBe("none");
    }
    const c = permsFor("custom", { team: "manage", billing: "manage", orders: "view", evil: "manage", products: "root" });
    expect(c.team).toBe("none");
    expect(c.billing).toBe("none");
    expect(c.orders).toBe("view");
    expect(c.products).toBe("none");
  });
  it("دور غير معروف = لا شيء", () => {
    expect(permsFor("hacker")).toEqual(NO_PERMS);
    expect(allows(null, "orders")).toBe(false);
  });
  it("مجال كل مسار، وأول صفحة مسموحة", () => {
    expect(areaForPath("/dashboard")).toBe("analytics");
    expect(areaForPath("/dashboard/orders/123")).toBe("orders");
    expect(areaForPath("/dashboard/categories")).toBe("products");
    expect(areaForPath("/dashboard/policies")).toBe("settings");
    expect(areaForPath("/dashboard/unknown")).toBeNull();
    expect(firstAllowedArea(permsFor("orders"))).toBe("orders");
    expect(firstAllowedArea(NO_PERMS)).toBeNull();
  });
});
