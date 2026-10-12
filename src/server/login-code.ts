import "server-only";
// login-code.ts — رمز دخول لمرة واحدة على البريد (بديل Google لصاحب المتجر وفريقه). 6 أرقام، صالح 10 دقائق، 5
// محاولات، يُخزَّن تجزئته فقط في Redis. لا يُرسل إلا لبريد معروف (تاجر أو عضو فريق مدعو)، والرد واحد دائماً حتى لا
// تكشف الصفحة أي البُرد مسجّلة.
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { merchants, storeMembers } from "@/db/schema";
import { redis } from "@/lib/redis";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email";

const TTL_S = 600;
const MAX_TRIES = 5;
const h = (v: string) => createHash("sha256").update(`${env.AUTH_SECRET}:${v}`).digest("hex");
const key = (email: string) => `lc:${h(email).slice(0, 32)}`;
// عدّاد المحاولات ذرّي (INCR) في مفتاح مستقل: الطلبات المتوازية لا تتجاوز الحد.
const triesKey = (email: string) => `lcn:${h(email).slice(0, 32)}`;

export const normalizeLoginEmail = (raw: string) => raw.trim().toLowerCase();

async function known(email: string): Promise<boolean> {
  const [m] = await db.select({ id: merchants.id }).from(merchants).where(eq(merchants.email, email)).limit(1);
  if (m) return true;
  const [inv] = await db.select({ id: storeMembers.id }).from(storeMembers).where(and(eq(storeMembers.email, email), eq(storeMembers.status, "active"))).limit(1);
  return Boolean(inv);
}

/** يرسل رمزاً إن كان البريد معروفاً. يعيد true إن أُرسل فعلاً (للسجل فقط، لا يُعرض للمستخدم). */
export async function sendLoginCode(email: string): Promise<boolean> {
  if (!(await known(email))) return false;
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await redis.set(key(email), JSON.stringify({ c: h(`${email}:${code}`), n: 0 }), { ex: TTL_S });
  await redis.del(triesKey(email));
  return sendEmail({
    to: email,
    subject: `رمز دخول لوحة متجرك: ${code}`,
    headline: "رمز الدخول",
    paragraphs: [`رمزك: ${code}`, "صالح 10 دقائق لمرة واحدة. لو لم تطلبه تجاهل هذه الرسالة؛ لا أحد يستطيع الدخول بدونه."],
  }).catch(() => false);
}

export type VerifyResult = "ok" | "wrong" | "expired" | "locked";

export async function verifyLoginCode(email: string, code: string): Promise<VerifyResult> {
  const raw = await redis.get<string | { c: string; n: number }>(key(email));
  if (!raw) return "expired";
  const rec = typeof raw === "string" ? (JSON.parse(raw) as { c: string; n: number }) : raw;
  const tries = await redis.incr(triesKey(email));
  if (tries === 1) await redis.expire(triesKey(email), TTL_S).catch(() => {});
  if (tries > MAX_TRIES) {
    await redis.del(key(email));
    return "locked";
  }
  const given = Buffer.from(h(`${email}:${code.replace(/\D/g, "")}`));
  const want = Buffer.from(rec.c);
  if (given.length === want.length && timingSafeEqual(given, want)) {
    await redis.del(key(email));
    await redis.del(triesKey(email));
    return "ok";
  }
  return tries >= MAX_TRIES ? "locked" : "wrong";
}
