import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getTableConfig } from "drizzle-orm/pg-core";
import { TENANT_TABLES } from "@/db/planes";

vi.mock("@/lib/env", () => ({ env: { AUTH_SECRET: "x".repeat(40) } }));

import { hostHint, isPrivateHost, safeError, validateDatabaseUrl } from "@/server/transfer/url";
import { decryptSecret, encryptSecret } from "@/server/transfer/crypto";
import { COPY_NAMES, COPY_PLAN, primaryKeyColumns } from "@/server/transfer/plan";
import { BATCH, copySteps, percent, prepareProgress, verifyCounts, type Ports, type Row } from "@/server/transfer/engine";
import { MIGRATIONS } from "@/server/transfer/migrations.generated";
import { branchNameFor, createBranchUrl, neonApiConfig } from "@/server/transfer/neon-api";

const GOOD = "postgresql://user:pass@ep-cool-123.eu-central-1.aws.neon.tech/neondb?sslmode=require";

describe("التحقق من رابط قاعدة العميل", () => {
  it("يقبل رابط Neon ويضيف sslmode", () => {
    const r = validateDatabaseUrl("postgresql://u:p@ep-a-1.us-east-2.aws.neon.tech/db");
    expect(r.ok && r.url.includes("sslmode=require")).toBe(true);
    expect(validateDatabaseUrl(`psql '${GOOD}'`).ok).toBe(true);
  });

  it("يرفض غير Postgres، والمضيفات الخاصة، وغير Neon، وبلا كلمة مرور، وsslmode=disable", () => {
    const bad = [
      "",
      "https://x.neon.tech/db",
      "postgresql://u:p@localhost/db",
      "postgresql://u:p@127.0.0.1/db",
      "postgresql://u:p@10.0.0.5/db",
      "postgresql://u:p@192.168.1.2/db",
      "postgresql://u:p@169.254.169.254/db",
      "postgresql://u:p@db.example.com/db",
      "postgresql://u@ep-a.neon.tech/db",
      "postgresql://u:p@ep-a.neon.tech/db?sslmode=disable",
      "postgresql://u:p@ep-a.neon.tech:6543/db",
      "postgresql://u:p@evil.neon.tech.attacker.com/db",
      "not a url",
    ];
    for (const b of bad) expect(validateDatabaseUrl(b).ok, b).toBe(false);
    expect(isPrivateHost("172.16.0.1")).toBe(true);
    expect(isPrivateHost("8.8.8.8")).toBe(false);
  });

  it("رسائل الخطأ لا تحمل الرابط ولا كلمة المرور", () => {
    const m = safeError(new Error(`connect failed ${GOOD} password=secret123`));
    expect(m).not.toContain("pass@");
    expect(m).not.toContain("secret123");
    expect(hostHint("ep-cool-123.eu-central-1.aws.neon.tech")).not.toContain("123.eu");
  });
});

describe("تشفير الرابط", () => {
  it("يعيد الأصل بنفس المفتاح ويفشل بغيره ولا يظهر النص الصريح", async () => {
    const enc = await encryptSecret(GOOD, "s".repeat(40));
    expect(enc).not.toContain("neon");
    expect(await decryptSecret(enc, "s".repeat(40))).toBe(GOOD);
    await expect(decryptSecret(enc, "t".repeat(40))).rejects.toThrow();
    expect(await encryptSecret(GOOD, "s".repeat(40))).not.toBe(enc);
  });
});

describe("خطة النسخ", () => {
  it("تغطي كل جداول بيانات المتجر + التاجر والمتجر وتصميمه", () => {
    for (const t of TENANT_TABLES) expect(COPY_NAMES).toContain(t);
    for (const t of ["merchants", "stores", "store_blueprints", "store_snapshots"]) expect(COPY_NAMES).toContain(t);
    expect(COPY_NAMES).not.toContain("store_secrets");
    expect(new Set(COPY_NAMES).size).toBe(COPY_NAMES.length);
  });

  it("الأب يسبق الابن في الترتيب (المفاتيح الأجنبية)", () => {
    const pos = new Map(COPY_NAMES.map((n, i) => [n, i]));
    for (const spec of COPY_PLAN) {
      for (const fk of getTableConfig(spec.table).foreignKeys) {
        const ref = getTableConfig(fk.reference().foreignTable).name;
        if (ref === spec.name || !pos.has(ref)) continue;
        expect(pos.get(ref)!, `${spec.name} → ${ref}`).toBeLessThan(pos.get(spec.name)!);
      }
    }
  });

  it("لكل جدول مفتاح أساسي للترتيب الثابت والإدراج المتكرر", () => {
    for (const spec of COPY_PLAN) expect(primaryKeyColumns(spec.table).length, spec.name).toBeGreaterThan(0);
  });
});

describe("migrations المضمَّنة", () => {
  it("مطابقة لمجلد delivery/overlay/drizzle (أعيدوا التوليد: npm run transfer:embed)", () => {
    const dir = join(__dirname, "..", "..", "delivery/overlay/drizzle");
    const journal = JSON.parse(readFileSync(join(dir, "meta/_journal.json"), "utf8")) as { entries: { tag: string; when: number }[] };
    expect(MIGRATIONS.map((m) => m.tag)).toEqual(journal.entries.map((e) => e.tag));
    expect(MIGRATIONS.map((m) => m.folderMillis)).toEqual(journal.entries.map((e) => e.when));
  });

  it("تنشئ كل جداول الخطة عدا الاختيارية", () => {
    const sql = MIGRATIONS.flatMap((m) => m.statements).join("\n");
    for (const spec of COPY_PLAN) {
      if (spec.optional) continue;
      expect(sql, spec.name).toMatch(new RegExp(`CREATE TABLE "${spec.name}"`));
    }
  });
});

// ─── المحرك بقاعدة وهمية ───────────────────────────────────────────────────────

function fake(sourceRows: Record<string, Row[]>, opts: { missing?: string[]; failOnce?: { table: string; at: number } } = {}) {
  const target: Record<string, Map<string, Row>> = {};
  const log: string[] = [];
  let failed = false;
  const ports: Ports = {
    hasTable: async (n) => !opts.missing?.includes(n),
    count: async (side, n) => (side === "source" ? (sourceRows[n] ?? []).length : (target[n]?.size ?? 0)),
    read: async (n, offset, limit) => (sourceRows[n] ?? []).slice(offset, offset + limit),
    write: async (n, rows) => {
      if (opts.failOnce && !failed && opts.failOnce.table === n && (target[n]?.size ?? 0) >= opts.failOnce.at) {
        failed = true;
        throw new Error("انقطع الاتصال");
      }
      log.push(n);
      target[n] ??= new Map();
      for (const r of rows) target[n]!.set(String(r.id), r);
    },
  };
  return { ports, target, log };
}

const rows = (n: number, tag = "a"): Row[] => Array.from({ length: n }, (_, i) => ({ id: `${tag}${String(i).padStart(5, "0")}`, v: i }));
const PLAN = [{ name: "categories" }, { name: "products" }, { name: "orders" }, { name: "support_threads", optional: true }];

describe("محرك النسخ", () => {
  it("ينسخ بالترتيب ويطابق الأعداد ويتجاوز الاختياري الفارغ الغائب", async () => {
    const f = fake({ categories: rows(3), products: rows(BATCH + 50, "p"), orders: rows(5, "o") }, { missing: ["support_threads"] });
    const p = await prepareProgress(f.ports, PLAN, 1);
    expect(p.tables.support_threads?.skipped).toBe(true);
    expect(await copySteps(f.ports, PLAN, p, { budgetMs: 10_000 })).toBe(true);
    expect(f.log.indexOf("categories")).toBeLessThan(f.log.indexOf("products"));
    expect(f.log.indexOf("products")).toBeLessThan(f.log.indexOf("orders"));
    expect(await verifyCounts(f.ports, PLAN, p)).toEqual([]);
    expect(percent(p)).toBe(100);
  });

  it("يرفض جدولاً اختيارياً غائباً من الهدف وفيه بيانات", async () => {
    const f = fake({ support_threads: rows(2) }, { missing: ["support_threads"] });
    await expect(prepareProgress(f.ports, PLAN, 1)).rejects.toThrow(/support_threads/);
  });

  it("يستأنف بعد انقطاع دون تكرار ولا فقد", async () => {
    const f = fake({ categories: rows(2), products: rows(BATCH * 2 + 10, "p"), orders: rows(4, "o") }, { failOnce: { table: "products", at: BATCH } });
    const p = await prepareProgress(f.ports, PLAN, 1);
    await expect(copySteps(f.ports, PLAN, p, { budgetMs: 10_000 })).rejects.toThrow("انقطع");
    const saved = JSON.parse(JSON.stringify(p)); // يُحفظ التقدم كبيانات
    expect(saved.tables.products.copied).toBe(BATCH);
    expect(await copySteps(f.ports, PLAN, saved, { budgetMs: 10_000 })).toBe(true);
    expect(await verifyCounts(f.ports, PLAN, saved)).toEqual([]);
    expect(f.target.products!.size).toBe(BATCH * 2 + 10);
  });

  it("تتوقف عند نفاد الميزانية وتكمل لاحقاً", async () => {
    const f = fake({ categories: rows(1), products: rows(BATCH * 3, "p"), orders: rows(1, "o") });
    const p = await prepareProgress(f.ports, PLAN, 1);
    let t = 0;
    const now = () => (t += 100);
    expect(await copySteps(f.ports, PLAN, p, { budgetMs: 250, now })).toBe(false);
    expect(await copySteps(f.ports, PLAN, p, { budgetMs: 1e9 })).toBe(true);
  });

  it("يكشف عدم تطابق الأعداد", async () => {
    const f = fake({ categories: rows(3), products: rows(2, "p"), orders: [] });
    const p = await prepareProgress(f.ports, PLAN, 1);
    await copySteps(f.ports, PLAN, p, { budgetMs: 10_000 });
    f.target.products!.delete("p00000");
    expect(await verifyCounts(f.ports, PLAN, p)).toEqual([{ table: "products", source: 2, target: 1 }]);
  });

  it("المزامنة الثانية تلتقط ما تغيّر (upsert) دون تكرار", async () => {
    const src = { categories: rows(2), products: rows(3, "p"), orders: rows(1, "o") };
    const f = fake(src);
    const p1 = await prepareProgress(f.ports, PLAN, 1);
    await copySteps(f.ports, PLAN, p1, { budgetMs: 10_000 });
    src.orders.push({ id: "o99999", v: 9 });
    (src.products[0] as Row).v = 777;
    const p2 = await prepareProgress(f.ports, PLAN, 2, p1);
    await copySteps(f.ports, PLAN, p2, { budgetMs: 10_000 });
    expect(await verifyCounts(f.ports, PLAN, p2)).toEqual([]);
    expect(f.target.products!.get("p00000")!.v).toBe(777);
  });
});

describe("قاعدة لكل متجر (Neon API)", () => {
  it("لا إعداد بلا مفتاح ومعرّف المشروع", () => {
    expect(neonApiConfig({})).toBeNull();
    expect(neonApiConfig({ NEON_API_KEY: "k" })).toBeNull();
    expect(neonApiConfig({ NEON_API_KEY: "k", NEON_PROJECT_ID: "p" })).toEqual({ key: "k", projectId: "p" });
  });

  it("اسم الفرع آمن ومميز", () => {
    expect(branchNameFor("12345678-aaaa", "Nova_Shop!")).toBe("store-novashop-12345678");
  });

  it("ينشئ فرعاً ويعيد الرابط، وأخطاؤه لا تحمل أسراراً", async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify({ connection_uris: [{ connection_uri: GOOD }] }), { status: 201 }));
    expect(await createBranchUrl({ key: "KEY", projectId: "p" }, "b", ok as never)).toBe(GOOD);
    const call = ok.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toContain("/projects/p/branches");
    const bad = vi.fn(async () => new Response("{}", { status: 422 }));
    await expect(createBranchUrl({ key: "KEY", projectId: "p" }, "b", bad as never)).rejects.toThrow(/خطة Neon/);
    const denied = vi.fn(async () => new Response("{}", { status: 403 }));
    await expect(createBranchUrl({ key: "KEY", projectId: "p" }, "b", denied as never)).rejects.not.toThrow(/KEY/);
  });
});
