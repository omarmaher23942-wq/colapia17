import "server-only";
// rate-window.ts — عدّاد نافذة ثابتة بسيط على Redis. عند تعطل Redis نسمح بالطلب (التجربة أهم من الحد) مع تسجيل الخطأ.
import { redis } from "@/lib/redis";

export async function rateLimit(key: string, limit: number, windowS: number): Promise<boolean> {
  try {
    const k = `rl:${key}`;
    const p = redis.pipeline();
    p.set(k, 0, { nx: true, ex: windowS });
    p.incr(k);
    const res = await p.exec<[unknown, number]>();
    return (res[1] ?? 0) <= limit;
  } catch (e) {
    console.error("[rate-limit] redis failed, allowing", e);
    return true;
  }
}
