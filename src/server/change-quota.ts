import "server-only";
// change-quota.ts — حصة «اطلب تعديل» الشهرية لمتجر (للخادم فقط: كانت مُصدَّرة من ملف "use server" فتصير نقطة استدعاء عامة).
import { and, count, eq, gte, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { storeChangeRequests } from "@/db/schema";
import { cairoMonthStart, perMonthFrom, remainingQuota } from "@/lib/change-requests";
import { getFlag } from "@/lib/flags";

export async function quotaFor(storeId: string, now = new Date()): Promise<{ perMonth: number; used: number; remaining: number }> {
  const [f, [r]] = await Promise.all([
    getFlag<Record<string, unknown>>("change_requests").catch(() => ({ enabled: true, config: null })),
    db
      .select({ n: count() })
      .from(storeChangeRequests)
      .where(and(eq(storeChangeRequests.storeId, storeId), ne(storeChangeRequests.status, "declined"), gte(storeChangeRequests.createdAt, cairoMonthStart(now)))),
  ]);
  const perMonth = perMonthFrom(f.config);
  const used = Number(r?.n ?? 0);
  return { perMonth, used, remaining: remainingQuota(used, perMonth) };
}
