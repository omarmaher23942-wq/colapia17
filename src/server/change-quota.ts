import "server-only";
// change-quota.ts — حصة «اطلب تعديل» لسنة اشتراك متجر (للخادم فقط: كانت مُصدَّرة من ملف "use server" فتصير نقطة استدعاء عامة).
import { and, count, eq, gte, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { storeChangeRequests, stores } from "@/db/schema";
import { perYearFrom, quotaPeriodEnd, quotaPeriodStart, remainingQuota } from "@/lib/change-requests";
import { getFlag } from "@/lib/flags";

export type Quota = { perYear: number; used: number; remaining: number; renewsAt: Date | null };

export async function quotaFor(storeId: string, now = new Date()): Promise<Quota> {
  const [f, [st]] = await Promise.all([
    getFlag<Record<string, unknown>>("change_requests").catch(() => ({ enabled: true, config: null })),
    db.select({ activatedAt: stores.activatedAt }).from(stores).where(eq(stores.id, storeId)).limit(1),
  ]);
  const activatedAt = st?.activatedAt ?? null;
  const [r] = await db
    .select({ n: count() })
    .from(storeChangeRequests)
    .where(and(eq(storeChangeRequests.storeId, storeId), ne(storeChangeRequests.status, "declined"), gte(storeChangeRequests.createdAt, quotaPeriodStart(activatedAt, now))));
  const perYear = perYearFrom(f.config);
  const used = Number(r?.n ?? 0);
  return { perYear, used, remaining: remainingQuota(used, perYear), renewsAt: quotaPeriodEnd(activatedAt, now) };
}
