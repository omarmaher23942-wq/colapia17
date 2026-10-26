// ports.ts — منافذ Neon الحقيقية للمحرك، واتجاهان: إلى الأمام (المنصة ← قاعدة العميل) وللخلف (الرجوع).
// وتجهيز الهدف (فحص الفراغ وتطبيق migrations).
import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { count, getTableColumns, sql } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { db, type DB } from "@/db/client";
import * as schema from "@/db/schema";
import { COPY_NAMES, primaryKeyColumns, specByName } from "./plan";
import type { Ports, Row } from "./engine";
import { MIGRATIONS } from "./migrations.generated";

type Client = NeonQueryFunction<false, false>;

/** اتصال بقاعدة: عميل drizzle + معرفة أعمدة كل جدول فيه (null = الجدول غير موجود). */
export type Conn = { db: DB; columns: (table: string) => Promise<Set<string> | null>; scoped: boolean };

const q = async (client: Client, text: string, params: unknown[] = []) => (await client.query(text, params as never[])) as Record<string, unknown>[];

export function connectExternal(url: string): { client: Client; conn: Conn } {
  const client = neon(url);
  const cache = new Map<string, Set<string> | null>();
  return {
    client,
    conn: {
      db: drizzle({ client, schema, casing: "snake_case" }) as unknown as DB,
      scoped: false, // لا يحوي غير هذا المتجر
      async columns(table) {
        if (!cache.has(table)) {
          const rows = await q(client, "select column_name from information_schema.columns where table_schema = 'public' and table_name = $1", [table]);
          cache.set(table, rows.length ? new Set(rows.map((r) => String(r.column_name))) : null);
        }
        return cache.get(table) ?? null;
      },
    },
  };
}

/** قاعدة المنصة كطرف في النقل (للرجوع): كل أعمدة المخطط موجودة، وفيها متاجر أخرى فيُحصر العدّ بالمتجر. */
export const platformConn: Conn = {
  db,
  scoped: true,
  async columns(table) {
    const spec = specByName(table);
    return spec ? new Set(Object.values(getTableColumns(spec.table)).map((c) => (c as AnyPgColumn).name)) : null;
  },
};

/** هل الهدف جاهز للنقل؟ فارغ، أو يحوي جداولنا فقط وبياناتها لهذا المتجر وحده (استئناف). */
export async function inspectTarget(client: Client, storeId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const tables = (await q(client, "select table_name from information_schema.tables where table_schema = 'public'")).map((r) => String(r.table_name));
  if (!tables.length) return { ok: true };
  const ours = new Set<string>([...COPY_NAMES, "system_events", "sessions", "store_settings"]);
  if (tables.some((t) => !ours.has(t))) return { ok: false, error: "قاعدة الهدف ليست فارغة: فيها جداول لا تخص المتجر. أنشئوا قاعدة جديدة فارغة للنقل." };
  if (tables.includes("stores")) {
    const others = await q(client, "select count(*)::int as n from stores where id <> $1", [storeId]);
    if (Number(others[0]?.n ?? 0) > 0) return { ok: false, error: "قاعدة الهدف تحوي بيانات متجر آخر. استخدموا قاعدة جديدة فارغة." };
  }
  return { ok: true };
}

/** يطبّق migrations المضمَّنة ذرياً على الهدف (كل migration معاملة واحدة مع تسجيلها)، وآمن للإعادة. */
export async function migrateTarget(client: Client): Promise<{ applied: number }> {
  await client.transaction([
    client.query('create schema if not exists "drizzle"'),
    client.query('create table if not exists "drizzle"."__drizzle_migrations" (id serial primary key, hash text not null, created_at bigint)'),
  ]);
  const last = await q(client, 'select created_at from "drizzle"."__drizzle_migrations" order by created_at desc limit 1');
  const lastMs = Number(last[0]?.created_at ?? 0);
  let applied = 0;
  for (const m of MIGRATIONS) {
    if (m.folderMillis <= lastMs) continue;
    await client.transaction([
      ...m.statements.map((st) => client.query(st)),
      client.query('insert into "drizzle"."__drizzle_migrations" ("hash", "created_at") values ($1, $2)', [m.hash, m.folderMillis]),
    ]);
    applied++;
  }
  return { applied };
}

const MAX_PARAMS = 30_000;

export function makePorts(source: Conn, target: Conn, store: { id: string; merchantId: string }): Ports {
  return {
    hasTable: async (name) => (await target.columns(name)) !== null,
    async count(side, name) {
      const spec = specByName(name)!;
      const conn = side === "source" ? source : target;
      const base = conn.db.select({ n: count() }).from(spec.table);
      const [r] = await (conn.scoped ? base.where(spec.scope(store.id, store.merchantId)) : base);
      return Number(r?.n ?? 0);
    },
    async read(name, offset, limit) {
      const spec = specByName(name)!;
      const scoped = source.db.select().from(spec.table);
      return (await (source.scoped ? scoped.where(spec.scope(store.id, store.merchantId)) : scoped)
        .orderBy(...primaryKeyColumns(spec.table))
        .limit(limit)
        .offset(offset)) as Row[];
    },
    async write(name, rows) {
      if (!rows.length) return;
      const spec = specByName(name)!;
      const have = await target.columns(name);
      if (!have) throw new Error(`جدول «${name}» غير موجود في قاعدة الهدف.`);
      const keep = Object.entries(getTableColumns(spec.table) as Record<string, AnyPgColumn>).filter(([, c]) => have.has(c.name));
      const pk = new Set(primaryKeyColumns(spec.table).map((c) => c.name));
      const set: Record<string, unknown> = {};
      for (const [prop, c] of keep) if (!pk.has(c.name)) set[prop] = sql.raw(`excluded."${c.name}"`);
      const chunk = Math.max(1, Math.floor(MAX_PARAMS / Math.max(1, keep.length)));
      for (let i = 0; i < rows.length; i += chunk) {
        const values = rows.slice(i, i + chunk).map((r) => {
          const o: Row = {};
          for (const [prop] of keep) o[prop] = r[prop];
          return { ...o, ...(spec.override ?? {}) };
        });
        const ins = target.db.insert(spec.table as PgTable).values(values as never);
        await (Object.keys(set).length ? ins.onConflictDoUpdate({ target: primaryKeyColumns(spec.table), set: set as never }) : ins.onConflictDoNothing());
      }
    },
  };
}
