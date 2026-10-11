import "server-only";
// guard.ts — حماية استمارة طلب المتجر العامة (بلا تسجيل دخول) من الإساءة والإغراق.
//
// الطبقات: مفتاح إيقاف من اللوحة (feature_flags «intake») ← نفس المصدر (Origin) ← حدود معدل لكل عملية ←
// فخ للبرامج الآلية (حقل مخفي + أقل زمن ملء) ← قرار الإرسال (decideIntake): طلب مفتوح لنفس وسيلة التواصل من
// القاعدة (لا يتأثر بتعطل Redis)، ثم حدود البريد والرقم والشبكة، ثم سقف يومي عام بأكبر العدّين (Redis والقاعدة).
// Redis متعطل = نسمح (تجربة العميل أهم) والقاعدة تبقى الحماية الأخيرة.
import { createHash } from "node:crypto";
import { and, count, eq, gte, ne, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { storeRequests } from "@/db/schema/agency";
import { redis } from "@/lib/redis";
import { clientEnv } from "@/lib/env";
import { clientIp, ipBucket } from "@/lib/client-ip";
import { getFlag } from "@/lib/flags";
import { notifyAdmin } from "@/ai/lifecycle/notify";
import { NextResponse } from "next/server";
import { decideIntake, limitsFrom, type IntakeDecision, type IntakeLimits } from "./rules";
import { DEFAULT_CAPACITY_PER_DAY } from "./eta";

export const INTAKE_FLAG = "intake";
/** أقل زمن حقيقي لملء الاستمارة: أسرع من ذلك = برنامج آلي (يُقبل بصمت ولا يُنشأ طلب). */
export const MIN_FILL_MS = 8_000;

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export type IntakeSettings = { enabled: boolean; limits: IntakeLimits; capacityPerDay: number };

/** إعداد الاستمارة من لوحة المالك (/admin/flags): التشغيل، والحدود، وطاقة الفريق اليومية لحساب موعد التسليم. */
export async function intakeSettings(): Promise<IntakeSettings> {
  const f = await getFlag<Record<string, unknown>>(INTAKE_FLAG).catch(() => ({ enabled: true, config: null }));
  const cap = Number(f.config?.capacityPerDay);
  return {
    enabled: f.enabled,
    limits: limitsFrom(f.config),
    capacityPerDay: Number.isInteger(cap) && cap > 0 && cap <= 100 ? cap : DEFAULT_CAPACITY_PER_DAY,
  };
}

/** الطلبات المُغيّرة تأتي من صفحات المنصة نفسها فقط (حماية CSRF لمسارات الـ API). */
export function sameOrigin(req: Request): boolean {
  const expected = new URL(clientEnv.NEXT_PUBLIC_APP_URL).origin;
  const origin = req.headers.get("origin");
  if (origin) return origin === expected;
  const referer = req.headers.get("referer");
  if (!referer) return false;
  try {
    return new URL(referer).origin === expected;
  } catch {
    return false;
  }
}

export const requestIp = (req: Request) => ipBucket(clientIp(req.headers));

/** عدّاد نافذة ثابتة. يُرجع false عند تجاوز الحد. */
export async function hit(key: string, limit: number, windowS: number): Promise<boolean> {
  try {
    const k = `rl:intake:${key}`;
    const p = redis.pipeline();
    p.set(k, 0, { nx: true, ex: windowS });
    p.incr(k);
    const res = await p.exec<[unknown, number]>();
    return (res[1] ?? 0) <= limit;
  } catch (e) {
    console.error("[intake] rate limit failed, allowing", e);
    return true;
  }
}

/** حقل مخفي ممتلئ أو إرسال أسرع من أي إنسان. */
export function looksAutomated(input: { honeypot?: unknown; createdAt: Date; now?: Date }): boolean {
  if (typeof input.honeypot === "string" && input.honeypot.trim()) return true;
  return (input.now ?? new Date()).getTime() - input.createdAt.getTime() < MIN_FILL_MS;
}

const cairoDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
const emailKey = (email: string) => createHash("sha256").update(email).digest("hex").slice(0, 24);

async function readCounters(keys: string[]): Promise<number[]> {
  try {
    const vals = await redis.mget<(number | string | null)[]>(...keys);
    return vals.map((v) => Number(v ?? 0) || 0);
  } catch {
    return keys.map(() => 0);
  }
}

async function bump(entries: [string, number][]): Promise<void> {
  try {
    const p = redis.pipeline();
    for (const [k, ttl] of entries) {
      p.incr(k);
      p.expire(k, ttl);
    }
    await p.exec();
  } catch (e) {
    console.error("[intake] counter failed", e);
  }
}

/** يفحص الإرسال ويحجزه عند السماح. email/whatsapp بعد التطبيع (أو null). */
export async function reserveIntake(input: { ip: string; email: string | null; whatsapp: string | null; limits: IntakeLimits }): Promise<IntakeDecision> {
  const day = cairoDay();
  const keys = {
    email: input.email ? `intake:email:${emailKey(input.email)}` : null,
    phone: input.whatsapp ? `intake:phone:${input.whatsapp}` : null,
    ip: input.ip && input.ip !== "0.0.0.0" ? `intake:ip:${input.ip}` : null,
    day: `intake:day:${day}`,
  };

  const contact = [
    input.email ? eq(storeRequests.email, input.email) : undefined,
    input.whatsapp ? eq(storeRequests.whatsapp, input.whatsapp) : undefined,
  ].filter((c): c is NonNullable<typeof c> => Boolean(c));

  const [openRows, todayRows, counters] = await Promise.all([
    contact.length
      ? db
          .select({ n: count() })
          .from(storeRequests)
          .where(and(eq(storeRequests.status, "submitted"), ne(storeRequests.stage, "delivery"), or(...contact)))
      : Promise.resolve([{ n: 0 }]),
    db
      .select({ n: count() })
      .from(storeRequests)
      .where(
        and(
          eq(storeRequests.status, "submitted"),
          gte(storeRequests.submittedAt, sql`date_trunc('day', now() at time zone 'Africa/Cairo') at time zone 'Africa/Cairo'`),
        ),
      ),
    readCounters([keys.email ?? "intake:none", keys.phone ?? "intake:none", keys.ip ?? "intake:none", keys.day]),
  ]);

  const [email7d = 0, phone7d = 0, ip24h = 0, dayCount = 0] = counters;
  const decision = decideIntake(
    {
      openForContact: Number(openRows[0]?.n ?? 0),
      email7d: keys.email ? email7d : 0,
      phone7d: keys.phone ? phone7d : 0,
      ip24h: keys.ip ? ip24h : 0,
      today: Math.max(dayCount, Number(todayRows[0]?.n ?? 0)),
    },
    input.limits,
  );

  if (!decision.ok) {
    if (decision.reason === "daily") {
      const first = await redis.set(`intake:cap-alert:${day}`, 1, { nx: true, ex: 172_800 }).catch(() => null);
      if (first) await notifyAdmin(`استمارة الوكالة بلغت السقف اليومي (${input.limits.dailyCap} طلباً). ارفعه من إعدادات «intake» في اللوحة إن كان الإقبال حقيقياً.`);
    }
    return decision;
  }

  const week = 7 * 86_400;
  await bump(
    [
      keys.email ? ([keys.email, week] as [string, number]) : null,
      keys.phone ? ([keys.phone, week] as [string, number]) : null,
      keys.ip ? ([keys.ip, 86_400] as [string, number]) : null,
      [keys.day, 129_600] as [string, number],
    ].filter((e): e is [string, number] => e !== null),
  );
  return decision;
}

/** حدود التفريغ الصوتي (يكلف ويشارك مفتاح Groq مع وكيل الرسائل): لكل طلب ولكل شبكة وسقف يومي عام. */
export async function allowTranscription(requestId: string, ip: string): Promise<boolean> {
  const [perRequest, perIp, global] = await Promise.all([
    hit(`tx:req:${requestId}`, 6, 86_400),
    hit(`tx:ip:${ip}`, 12, 86_400),
    hit(`tx:day:${cairoDay()}`, 300, 129_600),
  ]);
  return perRequest && perIp && global;
}
