import "server-only";
// purge.ts — حذف مسودات الحجز المنتهية (لم تُرسل خلال 21 يوماً من آخر نشاط) مع إيصالاتها المرفوعة. يُستدعى من ops/tick.
import { and, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { storeRequestAssets, storeRequests } from "@/db/schema";
import { mediaApi } from "@/server/media-host";
import { r2KeyFromUrl } from "@/lib/media";

export async function purgeExpiredBookingDrafts(now = new Date()): Promise<number> {
  const rows = await db.select({ id: storeRequests.id }).from(storeRequests).where(and(eq(storeRequests.status, "draft"), lt(storeRequests.expiresAt, now))).limit(100);
  if (!rows.length) return 0;
  const ids = rows.map((r) => r.id);
  const assets = await db.select({ url: storeRequestAssets.url, key: storeRequestAssets.key }).from(storeRequestAssets).where(inArray(storeRequestAssets.requestId, ids));
  const host = await mediaApi().catch(() => null);
  if (host && assets.length) await host.remove(assets.map((a) => r2KeyFromUrl(a.url) ?? a.key)).catch(() => false);
  await db.delete(storeRequests).where(inArray(storeRequests.id, ids));
  return ids.length;
}
