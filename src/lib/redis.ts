import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

export const rkeys = {
  storeBySubdomain: (sub: string) => `store:sub:${sub}`,
  blueprint: (storeId: string) => `store:bp:${storeId}`,
  storefrontHome: (storeId: string) => `sf:home:${storeId}`,
  recentOrdersProof: (storeId: string) => `sf:proof:${storeId}`,
  productViews: (storeId: string) => `an:views:${storeId}`,
  coPurchase: (storeId: string, productId: string) => `rec:co:${storeId}:${productId}`,
} as const;

export async function cached<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  try {
    const hit = await redis.get<T>(key);
    if (hit !== null && hit !== undefined) return hit;
  } catch (e) {
    console.error(`[redis:cached] read error on key ${key}, falling back to DB:`, e);
  }

  const value = await fn();

  if (value !== null && value !== undefined) {
    try {
      await redis.set(key, value, { ex: ttlSeconds });
    } catch (e) {
      console.error(`[redis:cached] write error on key ${key}:`, e);
    }
  }

  return value;
}