import "server-only";
// visual-search-misses.ts — ما بحث عنه العملاء بالصورة ولم يجدوه في المتجر (وصف نصي فقط، لا الصورة): آخر 50 لـ90
// يوماً، يراه التاجر في صفحة المنتجات فيعرف ما يطلبه الناس وليس عنده.
import { redis } from "@/lib/redis";

const MAX = 50;
const key = (storeId: string) => `vs:miss:${storeId}`;

export async function logVisualMiss(storeId: string, seen: string | null): Promise<void> {
  if (!seen) return;
  await redis.lpush(key(storeId), JSON.stringify({ at: new Date().toISOString(), seen: seen.slice(0, 200) })).catch(() => {});
  await redis.ltrim(key(storeId), 0, MAX - 1).catch(() => {});
  await redis.expire(key(storeId), 90 * 86400).catch(() => {});
}

export async function visualSearchMisses(storeId: string): Promise<{ at: string; seen: string }[]> {
  const rows = (await redis.lrange(key(storeId), 0, MAX - 1).catch(() => [])) as unknown[];
  return rows.flatMap((r) => {
    try {
      const v = typeof r === "string" ? JSON.parse(r) : r;
      return v && typeof v.seen === "string" ? [{ at: String(v.at), seen: v.seen as string }] : [];
    } catch {
      return [];
    }
  });
}
