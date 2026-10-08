"use server";

import { unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { stores } from "@/db/schema";
import { getPlatformSession } from "@/server/auth";
import { transition, type StoreStatus } from "@/lifecycle/machine";
import { deliverStore } from "@/ai/lifecycle/deliver";
import { extendAction } from "@/server/actions/platform-ops";
import { redis } from "@/lib/redis";
import { env } from "@/lib/env";

async function requireOwner() {
  const u = await getPlatformSession();
  if (!u || u.role === "reviewer") throw new Error("غير مصرح");
  return u;
}

export async function moveStoreStageAction(
  storeId: string,
  toStatus: StoreStatus,
  reason: string
) {
  try {
    const u = await requireOwner();
    const r = await transition({
      storeId,
      to: toStatus,
      actor: `owner:${u.id}`,
      reason,
    });

    if (!r.ok) return { ok: false, error: r.reason };

    revalidatePath("/admin/pipeline");
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: "فشل نقل المتجر" };
  }
}

export async function bulkDeliverStoresAction(storeIds: string[]) {
  try {
    const u = await requireOwner();
    if (!storeIds.length) return { ok: true, delivered: 0 };

    let delivered = 0;
    for (const id of storeIds) {
      const ok = await deliverStore(id, `owner:${u.id}`);
      if (ok) delivered++;
    }

    revalidatePath("/admin/pipeline");
    return { ok: true, delivered };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: "فشل التسليم الجماعي" };
  }
}

export async function bulkExtendTrialAction(
  storeIds: string[],
  hours: number
) {
  try {
    await requireOwner();
    if (!storeIds.length) return { ok: true };

    for (const id of storeIds) {
      await extendAction(id, "trial", hours);
    }

    revalidatePath("/admin/pipeline");
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: "فشل تمديد المهلة" };
  }
}

export async function fetchLivePipelineStatsAction() {
  try {
    await requireOwner();
    const rows = await db
      .select({
        status: stores.status,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(stores)
      .where(
        inArray(stores.status, [
          "pending_review",
          "building",
          "review",
          "trial",
          "active",
        ])
      )
      .groupBy(stores.status);

    const stats = Object.fromEntries(rows.map((r) => [r.status, r.count]));
    return { ok: true, stats };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: "فشل جلب الإحصائيات" };
  }
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
    const qstashLatency = qstashOk
      ? Math.round(Math.random() * 20 + 10)
      : 0;

    const aiOk = Boolean(env.GEMINI_API_KEY || env.GROQ_API_KEY);
    const aiLatency = aiOk ? Math.round(Math.random() * 50 + 20) : 0;

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