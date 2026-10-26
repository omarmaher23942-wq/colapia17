import "server-only";
// migrate.ts — تجهيز قاعدة البيانات من صفحة /setup: يطبّق ملفات drizzle المضمَّنة (src/db/migrations.generated.ts) بنفس جدول
// drizzle.__drizzle_migrations الذي يستخدمه `npm run db:migrate`، فلا تعارض بين الطريقتين. كل ملف في معاملة واحدة (ينجح كله
// أو لا شيء)، وإعادة التشغيل آمنة: ما طُبّق سابقاً يُتخطى.
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { resolveDatabaseUrl } from "@/lib/env";
import { MIGRATIONS } from "@/db/migrations.generated";

export type MigrationState = { total: number; applied: number; pending: number };

const MIGRATIONS_TABLE = "drizzle.__drizzle_migrations";

async function lastApplied(sql: NeonQueryFunction<false, false>): Promise<number> {
  try {
    const rows = (await sql.query(`select created_at from ${MIGRATIONS_TABLE} order by created_at desc limit 1`)) as { created_at: string | number }[];
    return rows[0] ? Number(rows[0].created_at) : -1;
  } catch {
    return -1; // الجدول غير موجود بعد
  }
}

/** كم migration طُبّق وكم بقي (يتطلب اتصالاً صالحاً بالقاعدة). */
export async function migrationState(): Promise<MigrationState> {
  const sql = neon(resolveDatabaseUrl());
  const last = await lastApplied(sql);
  const applied = MIGRATIONS.filter((m) => m.folderMillis <= last).length;
  return { total: MIGRATIONS.length, applied, pending: MIGRATIONS.length - applied };
}

export async function runMigrations(): Promise<{ applied: number }> {
  const sql = neon(resolveDatabaseUrl());
  await sql.query("CREATE SCHEMA IF NOT EXISTS drizzle");
  await sql.query(`CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`);
  const last = await lastApplied(sql);
  let applied = 0;
  for (const m of MIGRATIONS) {
    if (m.folderMillis <= last) continue;
    await sql.transaction([
      ...m.statements.map((stmt) => sql.query(stmt)),
      sql.query(`insert into ${MIGRATIONS_TABLE} ("hash", "created_at") values ($1, $2)`, [m.hash, m.folderMillis]),
    ]);
    applied++;
  }
  return { applied };
}
