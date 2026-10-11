"use server";

import { unstable_rethrow } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { requirePlatformCap } from "@/server/platform-guard";
import { redis } from "@/lib/redis";
import { env } from "@/lib/env";

async function requireOwner() {
  const u = await requirePlatformCap("stores.manage", "غير مصرح");
  return u;
}

export async function checkSystemHealthAction() {
  try {
    await requireOwner();
    const t0 = performance.now();

    let dbOk = false;
    let dbLatency = 0;
    try {
      const dbStart = performance.now();
      await db.execute(sql`SELECT 1`);
      dbLatency = Math.round(performance.now() - dbStart);
      dbOk = true;
    } catch {
      dbOk = false;
    }

    let redisOk = false;
    let redisLatency = 0;
    try {
      const rStart = performance.now();
      await redis.ping();
      redisLatency = Math.round(performance.now() - rStart);
      redisOk = true;
    } catch {
      redisOk = false;
    }

    const qstashOk = Boolean(env.QSTASH_TOKEN);
    // QStash والذكاء الاصطناعي: نفحص وجود الإعداد فقط (لا قياس زمن حقيقي لهما هنا).
    const qstashLatency = 0;

    const aiOk = Boolean(env.GEMINI_API_KEY || env.GROQ_API_KEY);
    const aiLatency = 0;

    return {
      ok: true,
      data: {
        db: { ok: dbOk, latency: dbLatency },
        redis: { ok: redisOk, latency: redisLatency },
        qstash: { ok: qstashOk, latency: qstashLatency },
        ai: { ok: aiOk, latency: aiLatency },
        totalLatency: Math.round(performance.now() - t0),
      },
    };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: "فشل فحص النظام" };
  }
}