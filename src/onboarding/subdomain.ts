import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { stores } from "@/db/schema";
import { redis } from "@/lib/redis";
import { RESERVED_SUBDOMAINS } from "@/lib/subdomains";

export type SubdomainCheck = "ok" | "invalid" | "reserved" | "taken";

export const RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
export const HOLD_TTL_S = 3600;
const holdKey = (sub: string) => `subhold:${sub}`;

/**
 * فحص توفر الرابط مع حجز مؤقت 60 دقيقة لصالح الجلسة، حتى لا يختار تاجران الاسم نفسه أثناء التعبئة.
 * الحجز تلطيف UX فقط: الضمان النهائي هو الفهرس الفريد عند إنشاء المتجر.
 */
export async function checkSubdomain(raw: string, sessionId: string): Promise<SubdomainCheck> {
  const sub = raw.trim().toLowerCase();
  if (!RE.test(sub) || sub.includes("--")) return "invalid";
  if (RESERVED_SUBDOMAINS.has(sub)) return "reserved";

  const [taken] = await db.select({ id: stores.id }).from(stores).where(eq(stores.subdomain, sub)).limit(1);
  if (taken) return "taken";

  const got = await redis.set(holdKey(sub), sessionId, { nx: true, ex: HOLD_TTL_S });
  if (got) return "ok";
  const holder = await redis.get<string>(holdKey(sub));
  if (holder === sessionId) {
    await redis.expire(holdKey(sub), HOLD_TTL_S);
    return "ok";
  }
  return "taken";
}

export async function releaseSubdomain(sub: string, sessionId: string) {
  const holder = await redis.get<string>(holdKey(sub));
  if (holder === sessionId) await redis.del(holdKey(sub));
}