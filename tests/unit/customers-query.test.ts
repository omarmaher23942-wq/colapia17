import { describe, expect, it } from "vitest";
import { parseCustomersQuery } from "@/server/repos/customers-list";

describe("parseCustomersQuery", () => {
  it("القيم الافتراضية", () => expect(parseCustomersQuery({})).toEqual({ segment: "all", sort: "recent", q: "", page: 1 }));
  it("روابط الصفحة القديمة تُفهم", () => {
    expect(parseCustomersQuery({ segment: "vip" }).segment).toBe("repeat");
    expect(parseCustomersQuery({ segment: "at_risk" }).segment).toBe("winback");
    expect(parseCustomersQuery({ segment: "churned" }).segment).toBe("winback");
  });
  it("قيم غير معروفة أو خطرة تُهمل", () => {
    const q = parseCustomersQuery({ segment: "x'; drop", sort: "evil", page: "-4", q: " ".repeat(3) + "أ".repeat(100) });
    expect(q.segment).toBe("all");
    expect(q.sort).toBe("recent");
    expect(q.page).toBe(1);
    expect(q.q.length).toBe(60);
  });
});
