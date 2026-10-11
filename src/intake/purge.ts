import "server-only";
// purge.ts — حذف مسودات استمارة الطلب التي انتهت مهلتها ولم تُرسل، مع ملفاتها من UploadThing. يشغّله ops/tick
// يومياً. الملفات أولاً (أفضل جهد)، ثم الصفوف (الملفات والسجل تُحذف معها بالمفتاح الأجنبي).
import { and, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { storeRequestAssets, storeRequests } from "@/db/schema/agency";
import { mediaApi } from "@/server/media-host";

export async function purgeExpiredDrafts(limit = 200): Promise<{ requests: number; files: number }> {
  const expired = await db
    .select({ id: storeRequests.id })
    .from(storeRequests)
    .where(and(eq(storeRequests.status, "draft"), lt(storeRequests.expiresAt, new Date())))
    .limit(limit);
  if (!expired.length) return { requests: 0, files: 0 };
  const ids = expired.map((r) => r.id);
  const keys = (await db.select({ key: storeRequestAssets.key }).from(storeRequestAssets).where(inArray(storeRequestAssets.requestId, ids))).map((a) => a.key);
  let files = 0;
  if (keys.length) {
    const api = await mediaApi();
    if (api) {
      const res = await api.deleteFiles(keys).catch(() => null);
      files = res?.deletedCount ?? 0;
    }
  }
  await db.delete(storeRequests).where(and(inArray(storeRequests.id, ids), eq(storeRequests.status, "draft")));
  return { requests: ids.length, files };
}
