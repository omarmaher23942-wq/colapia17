// /api/health — فحص الصحة للمضيف (Railway يفحصه قبل تحويل الزيارات للنسخة الجديدة) ولمراقبة التوقف.
// يتحقق من القاعدة وRedis بمهلة قصيرة لكل منهما، ولا يكشف أي سر أو رسالة خطأ داخلية.
// 200 = جاهز، و503 = القاعدة لا تستجيب (Redis وحده لا يُسقط الفحص: المتجر يعمل بدونه بأداء أقل).
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { redis } from "@/lib/redis";

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

export async function GET() {
  const [database, cache] = await Promise.all([probe(() => db.execute(sql`select 1`)), probe(() => redis.ping())]);
  const ok = database.ok;
  return NextResponse.json(
    { ok, database, redis: cache, version: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
