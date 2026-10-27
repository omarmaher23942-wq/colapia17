import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { isOwnHost } from "@/lib/email-track";
import { safeInternalPath } from "@/lib/safe-redirect";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const read = (p: string) => readFileSync(p, "utf8");

describe("وجهات النقر في الرسائل (منع إعادة التوجيه المفتوحة)", () => {
  it("يقبل النطاق الرئيسي ونطاقاته الفرعية فقط", () => {
    expect(isOwnHost("colapia.com", "colapia.com")).toBe(true);
    expect(isOwnHost("www.colapia.com", "colapia.com")).toBe(true);
    expect(isOwnHost("nova.colapia.com", "colapia.com")).toBe(true);
    expect(isOwnHost("COLAPIA.com.", "colapia.com")).toBe(true);
  });
  it("يرفض المقلَّد والمضيف الخارجي", () => {
    expect(isOwnHost("evil-colapia.com", "colapia.com")).toBe(false);
    expect(isOwnHost("colapia.com.evil.io", "colapia.com")).toBe(false);
    expect(isOwnHost("evil.com", "colapia.com")).toBe(false);
    expect(isOwnHost("", "colapia.com")).toBe(false);
  });
  it("مسار التتبع موجود فعلاً تحت [action] (كان الملف على /api/email/track وحده فتعيد /open و/click 404)", () => {
    expect(existsSync("src/app/api/email/track/[action]/route.ts")).toBe(true);
    expect(existsSync("src/app/api/email/track/route.ts")).toBe(false);
  });
});

describe("safeInternalPath", () => {
  it("يقبل المسارات الداخلية", () => {
    expect(safeInternalPath("/dashboard/orders?x=1", "/dashboard")).toBe("/dashboard/orders?x=1");
    expect(safeInternalPath("/admin", "/")).toBe("/admin");
  });
  it("يرفض الخارجي والمموَّه", () => {
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "/\\/evil.com", "/ok\n//evil", "javascript:alert(1)", "", null, undefined, 5]) {
      expect(safeInternalPath(bad, "/dashboard")).toBe("/dashboard");
    }
  });
  it("البادئة الإلزامية", () => {
    expect(safeInternalPath("/dashboard/billing", "/dashboard", { prefix: "/dashboard" })).toBe("/dashboard/billing");
    expect(safeInternalPath("/dashboard", "/x", { prefix: "/dashboard" })).toBe("/dashboard");
    expect(safeInternalPath("/dashboardevil", "/dashboard", { prefix: "/dashboard" })).toBe("/dashboard");
    expect(safeInternalPath("/admin", "/dashboard", { prefix: "/dashboard" })).toBe("/dashboard");
  });
});

describe("قفل اللوحة لا يُتجاوز", () => {
  it("storeFor يقفل القراءة أيضاً (التصدير) لا الكتابة وحدها", () => {
    const g = read("src/server/merchant-guard.ts");
    expect(g).toMatch(/area !== "billing" && \(await storeLock\(s\.store\)\)/);
    expect(g).not.toMatch(/level === "manage" && area !== "billing"/);
  });
  it("ownerStore يقفل صاحب المتجر إلا الاشتراك والحساب (allowLocked)", () => {
    expect(read("src/server/merchant-guard.ts")).toMatch(/!opts\.allowLocked && \(await storeLock/);
    for (const f of ["src/server/actions/account.ts", "src/server/upload-policies.ts"]) {
      expect(read(f)).toMatch(/ownerStore\(\{ allowLocked: true \}\)/);
    }
    // أي استدعاء آخر لا يمر بالقفل (النطاق، الرابط، الإعداد).
    const others = walk("src").filter((f) => /\.(ts|tsx)$/.test(f) && !/merchant-guard|connections\.ts$|account\.ts$|upload-policies/.test(f));
    for (const f of others) expect(read(f)).not.toMatch(/ownerStore\(\{ allowLocked/);
  });
  it("واجهات اللوحة تتحقق من القفل", () => {
    expect(read("src/app/api/dashboard/attention/route.ts")).toMatch(/storeLock/);
    expect(read("src/app/api/dashboard/search/route.ts")).toMatch(/storeLock/);
  });
});

describe("إغلاق الوكيل بعد الموافقة", () => {
  it("«استئناف الكل» لا يوقظ محادثات agent_done", () => {
    expect(read("src/server/actions/launch.ts")).toMatch(/closedBy.*<> 'agent_done'/);
  });
  it("الليد يُحفظ ويُغلق الوكيل قبل إرسال رسالة الإغلاق (فشل Meta لا يضيّع العميل)", () => {
    const r = read("src/ai/agents/closer/runtime.ts");
    const fn = r.slice(r.indexOf("async function captureLead"));
    expect(fn.indexOf("patchMemory(conv.id, { v6Lead")).toBeGreaterThan(0);
    expect(fn.indexOf("patchMemory(conv.id, { v6Lead")).toBeLessThan(fn.indexOf("metaApi.text"));
    expect(fn).toMatch(/closedBy: "agent_done"/);
  });
  it("تغيير المرحلة اليدوي لا يوقظ وكيلاً مغلقاً", () => {
    const c = read("src/server/actions/platform-conv.ts");
    expect(c).toMatch(/closed/);
    expect(c).toMatch(/enumValues/);
  });
});
