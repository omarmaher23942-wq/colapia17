import { describe, expect, it } from "vitest";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { ANCHOR_TABLES, CONTROL_TABLES, TENANT_TABLES } from "@/db/planes";

const tables = Object.values(schema as Record<string, unknown>)
  .filter((v): v is PgTable => v instanceof PgTable)
  .map((t) => getTableConfig(t));

const tenant = new Set<string>(TENANT_TABLES);
const control = new Set<string>(CONTROL_TABLES);
const anchors = new Set<string>(ANCHOR_TABLES);

// مفاتيح من بيانات المتجر إلى جداول تحكم غير الـ anchors (مسموحة استثناءً).
const ALLOWED_CONTROL_REFS = new Set(["support_threads.assigned_to"]);

describe("data planes", () => {
  it("classifies every table exactly once", () => {
    const names = tables.map((t) => t.name).sort();
    const classified = [...TENANT_TABLES, ...CONTROL_TABLES].sort();
    expect(classified).toEqual(names);
    expect(TENANT_TABLES.filter((t) => control.has(t))).toEqual([]);
  });

  it("gives every tenant table a store_id column", () => {
    const missing = tables
      .filter((t) => tenant.has(t.name))
      .filter((t) => !t.columns.some((c) => c.name === "store_id"))
      .map((t) => t.name);
    expect(missing).toEqual([]);
  });

  it("never points a control table at tenant data", () => {
    const bad = tables
      .filter((t) => control.has(t.name))
      .flatMap((t) =>
        t.foreignKeys
          .map((fk) => fk.reference())
          .filter((r) => tenant.has(getTableConfig(r.foreignTable).name))
          .map((r) => `${t.name}.${r.columns[0]!.name}`)
      );
    expect(bad).toEqual([]);
  });

  it("lets tenant data reference only tenant tables and anchors", () => {
    const bad = tables
      .filter((t) => tenant.has(t.name))
      .flatMap((t) =>
        t.foreignKeys
          .map((fk) => fk.reference())
          .filter((r) => {
            const target = getTableConfig(r.foreignTable).name;
            return !tenant.has(target) && !anchors.has(target);
          })
          .map((r) => `${t.name}.${r.columns[0]!.name}`)
      )
      .filter((k) => !ALLOWED_CONTROL_REFS.has(k));
    expect(bad).toEqual([]);
  });
});

describe("store purge plan", () => {
  it("deletes every tenant table plus the blueprint and its history", async () => {
    const { PURGE_TABLES } = await import("@/server/store-purge-plan");
    expect([...PURGE_TABLES].sort()).toEqual(["store_blueprints", "store_snapshots", ...TENANT_TABLES].sort());
  });

  it("lists parents before children so the reversed delete never breaks a foreign key", async () => {
    const { PURGE_PLAN } = await import("@/server/store-purge-plan");
    const order = PURGE_PLAN.map((p: { table: PgTable }) => getTableConfig(p.table).name);
    const late = PURGE_PLAN.flatMap((p: { table: PgTable }, i: number) =>
      getTableConfig(p.table)
        .foreignKeys.map((fk) => getTableConfig(fk.reference().foreignTable).name)
        .filter((target) => order.includes(target) && order.indexOf(target) >= i && target !== order[i])
        .map((target) => `${order[i]} -> ${target}`)
    );
    expect(late).toEqual([]);
  });
});
