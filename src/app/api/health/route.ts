// /api/health — فحص الصحة. بلا رمز: حالة عامة بلا تفاصيل. برمز (HEALTH_TOKEN أو CRON_SECRET في Authorization: Bearer)
// يضيف: التحديثات غير المطبّقة، والمفاتيح الناقصة (أسماء فقط)، ونبضة المهام المجدولة. لا يكشف سراً ولا رسالة خطأ داخلية.
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { redis } from "@/lib/redis";
import { missingKeys, summarize, tokenMatches } from "@/lib/health";
import journal from "../../../../drizzle/meta/_journal.json";

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 3000;

async function probe(fn: () => Promise<unknown>): Promise<{ ok: boolean; ms: number }> {
  const t = Date.now();
  try {
    await Promise.race([fn(), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), TIMEOUT_MS))]);
    return { ok: true, ms: Date.now() - t };
  } catch {
    return { ok: false, ms: Date.now() - t };
  }
}

async function pendingMigrations(): Promise<number | null> {
  try {
    const r = (await db.execute(sql`select max(created_at)::text as last from drizzle.__drizzle_migrations`)) as unknown as { rows?: { last: string | null }[] } | { last: string | null }[];
    const rows = Array.isArray(r) ? r : r.rows ?? [];
    const last = Number(rows[0]?.last ?? 0);
    return journal.entries.filter((e) => e.when > last).length;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  const deep = tokenMatches(bearer, process.env.HEALTH_TOKEN) || tokenMatches(bearer, process.env.CRON_SECRET);
  const [database, cache] = await Promise.all([probe(() => db.execute(sql`select 1`)), probe(() => redis.ping())]);
  const version = process.env.BUILD_COMMIT_SHA?.slice(0, 7) || null;
  if (!deep) {
    const s = summarize({ database });
    return NextResponse.json({ ok: database.ok, status: s.status, version }, { status: s.httpStatus, headers: { "Cache-Control": "no-store" } });
  }
  const [pending, tick, sweep] = await Promise.all([
    database.ok ? pendingMigrations() : Promise.resolve(null),
    redis.get<string>("ops:last:tick").catch(() => null),
    redis.get<string>("ops:last:sweep").catch(() => null),
  ]);
  const missing = missingKeys(process.env);
  const s = summarize({ database, redis: cache, pendingMigrations: pending, missingKeys: missing });
  return NextResponse.json(
    { ok: database.ok, status: s.status, reasons: s.reasons, database, redis: cache, pendingMigrations: pending, missingKeys: missing, jobs: { tick: tick ?? null, sweep: sweep ?? null }, version },
    { status: s.httpStatus, headers: { "Cache-Control": "no-store" } }
  );
}
