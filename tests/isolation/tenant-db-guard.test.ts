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
  "src/app/(platform)/(dash)/admin/page.tsx",
  "src/app/(platform)/(dash)/admin/stores/[id]/page.tsx",
  "src/app/(platform)/dashboard/content/page.tsx",
  "src/app/(platform)/dashboard/store/[id]/page.tsx",
  "src/app/api/jobs/lifecycle/route.ts",
  "src/app/api/workflows/build/route.ts",
  "src/server/actions/ai-editor.ts",
  "src/server/actions/checkout.ts",
  "src/server/actions/inventory.ts",
  "src/server/actions/platform-stores-governance.ts",
  "src/server/actions/shipping.ts",
  "src/server/auth.ts",
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

  it("keeps the reviewed list free of stale entries", () => {
    const mixed = new Set(files.filter((f) => f.text.includes('from "@/db/client"')).map((f) => f.rel));
    expect([...REVIEWED_MIXED].filter((f) => !mixed.has(f))).toEqual([]);
  });
});
