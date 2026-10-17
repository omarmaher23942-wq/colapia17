import "server-only";
import { createHash } from "node:crypto";
import { redis } from "@/lib/redis";

/** عدّاد نافذة ثابتة بمفتاح مجزّأ (الشبكة والرقم لا يظهران نصاً في Redis). يُرجع false عند تجاوز الحد، ويسمح إن تعطل Redis. */
export async function hit(key: string, limit: number, windowS: number): Promise<boolean> {
  try {
    const k = `rl:hit:${createHash("sha256").update(key).digest("hex").slice(0, 32)}`;
    const p = redis.pipeline();
    p.set(k, 0, { nx: true, ex: windowS });
    p.incr(k);
    const res = await p.exec<[unknown, number]>();
    return (res[1] ?? 0) <= limit;
  } catch (e) {
    console.error("[rate-hit] failed, allowing", e);
    return true;
  }
}
