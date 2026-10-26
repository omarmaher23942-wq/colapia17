// حارس طبقة الوصول: أي ملف يستعلم جداول بيانات المتجر يمر عبر "@/db/tenant" (getTenantDb).
// الملفات التي تجمع بين قاعدة المنصة (db) وبيانات المتجر مسجّلة هنا صراحة بعد مراجعتها:
// فيها كل استعلام على بيانات المتجر يستخدم متغير قاعدة المتجر (tdb أو db محلي من getTenantDb).
// ملف مختلط جديد يفشل هذا الاختبار حتى يُراجع ويُضاف.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { TENANT_TABLES } from "@/db/planes";

const ROOT = join(__dirname, "..", "..");
const SRC = join(ROOT, "src");

const camel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const TENANT_IDENTS = TENANT_TABLES.map(camel).join("|");
const TENANT_QUERY = new RegExp(
  `\\.(from|insert|update|delete|innerJoin|leftJoin|rightJoin|fullJoin)\\((${TENANT_IDENTS})\\b|\\.query\\.(${TENANT_IDENTS})\\.`
);

const REVIEWED_MIXED = new Set([
  // التسويق: الـ Blueprint من قاعدة المنصة، والتحقق من وجهة الحملة وكودها من بيانات المتجر.
  "src/server/actions/marketing.ts",
  "src/server/actions/size-guide.ts", // الـ Blueprint (تحكم) + التحقق من أقسام المتجر (بيانات)
  // التقرير الشهري: قائمة المتاجر وبريد أصحابها من قاعدة المنصة، والأرقام من بيانات كل متجر.
  "src/app/(platform)/(dash)/admin/page.tsx",
  "src/app/(platform)/(dash)/admin/stores/[id]/page.tsx",
  "src/app/(platform)/dashboard/content/page.tsx",
  "src/server/actions/checkout.ts",
  "src/server/actions/inventory.ts",
  "src/server/actions/motion.ts",
  "src/server/actions/platform-stores-governance.ts",
  "src/server/actions/shipping.ts",
  // قراءات الإعداد: الـ Blueprint (تحكم) + أعداد المنتجات والأقسام والشحن من بيانات المتجر بـ tdb.
  "src/server/setup-data.ts",
  "src/server/actions/setup.ts", // تقدم الإعداد والتفعيل على stores (تحكم)، وكل استعلام منتجات/أقسام/شحن عبر tdb
]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

const files = walk(SRC)
  .filter((p) => !p.includes(`${sep}db${sep}`))
  .map((p) => ({ rel: relative(ROOT, p).split(sep).join("/"), text: readFileSync(p, "utf8") }))
  .filter((f) => TENANT_QUERY.test(f.text));

describe("tenant data access", () => {
  it("routes every tenant-table query through @/db/tenant", () => {
    const offenders = files.filter((f) => !f.text.includes('from "@/db/tenant"')).map((f) => f.rel);
    expect(offenders).toEqual([]);
  });

  it("only mixes platform and tenant databases in reviewed files", () => {
    const mixed = files.filter((f) => f.text.includes('from "@/db/client"')).map((f) => f.rel);
    expect(mixed.filter((f) => !REVIEWED_MIXED.has(f))).toEqual([]);
  });

  it("exposes the platform copy of tenant data only to the transfer machinery", () => {
    const all = walk(SRC)
      .map((p) => ({ rel: relative(ROOT, p).split(sep).join("/"), text: readFileSync(p, "utf8") }))
      .filter((f) => /\bplatformCopyDb\b/.test(f.text))
      .map((f) => f.rel);
    expect(all.filter((f) => f !== "src/db/tenant.ts" && !f.startsWith("src/server/transfer/"))).toEqual([]);
  });

  it("never lets the routing lookup leak a client database URL into logs", () => {
    const text = readFileSync(join(SRC, "server/transfer/index.ts"), "utf8") + readFileSync(join(SRC, "db/tenant.ts"), "utf8");
    expect(text).not.toMatch(/log\.\w+\([^)]*\b(databaseUrl|targetUrlEnc|urlEnc|url)\b/);
  });

  it("keeps the reviewed list free of stale entries", () => {
    const mixed = new Set(files.filter((f) => f.text.includes('from "@/db/client"')).map((f) => f.rel));
    expect([...REVIEWED_MIXED].filter((f) => !mixed.has(f))).toEqual([]);
  });
});
