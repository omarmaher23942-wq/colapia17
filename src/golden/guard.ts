import "server-only";
// guard.ts — حماية صفحة الحجز العامة (بلا تسجيل دخول) من الإساءة والإغراق.
// الطبقات: مفتاح إيقاف (feature_flags «booking») ← نفس المصدر (Origin) ← حدود معدل لكل عملية ← فخ للبرامج الآلية
// (حقل مخفي + أقل زمن ملء بتذكرة موقّعة من الخادم) ← حد لكل بريد ← منع الحجز المكرر المفتوح. Redis متعطل = نسمح (القاعدة
// وفهارسها الفريدة خط الدفاع الأخير).
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env, clientEnv, getOwnerAlertEmails } from "@/lib/env";
import { getFlag } from "@/lib/flags";
import { hit } from "@/lib/rate-hit";
import { clientIp, ipBucket } from "@/lib/client-ip";
import { canonicalEmail } from "@/lib/contact";

export const BOOKING_FLAG = "booking";
/** أقل زمن حقيقي لملء الصفحة: أسرع من ذلك = برنامج آلي. */
export const MIN_FILL_MS = 8_000;
/** صلاحية تذكرة الصفحة المفتوحة. */
const TICKET_TTL_MS = 6 * 3_600_000;

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function bookingEnabled(): Promise<boolean> {
  const f = await getFlag<Record<string, unknown>>(BOOKING_FLAG).catch(() => ({ enabled: true, config: null }));
  return f.enabled;
}

/** الطلب من صفحتنا نفسها (Origin أو Referer يطابق موقعنا أو مضيف الطلب). */
export function sameOrigin(req: Request): boolean {
  const expected = new URL(clientEnv.NEXT_PUBLIC_APP_URL).origin;
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0]?.trim().toLowerCase();
  const ok = (value: string) => {
    try {
      const u = new URL(value);
      return u.origin === expected || (Boolean(host) && u.host.toLowerCase() === host && (u.protocol === "https:" || u.hostname === "localhost"));
    } catch {
      return false;
    }
  };
  const origin = req.headers.get("origin");
  if (origin) return ok(origin);
  const referer = req.headers.get("referer");
  return referer ? ok(referer) : false;
}

const sign = (ts: number) => createHmac("sha256", env.AUTH_SECRET).update(`golden:fill:${ts}`).digest("base64url").slice(0, 24);

/** تذكرة تصدرها الصفحة عند فتحها: وقت الفتح موقّعاً، فلا يزوّر برنامج آلي أنه ملأ النموذج ببطء. */
export function issueFillTicket(now = Date.now()): string {
  return `${now}.${sign(now)}`;
}

export type TicketCheck = "ok" | "too_fast" | "expired" | "invalid";

export function checkFillTicket(ticket: unknown, now = Date.now()): TicketCheck {
  if (typeof ticket !== "string") return "invalid";
  const [tsRaw, mac] = ticket.split(".");
  const ts = Number(tsRaw);
  if (!Number.isFinite(ts) || !mac) return "invalid";
  const a = Buffer.from(sign(ts));
  const b = Buffer.from(mac);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return "invalid";
  if (now - ts > TICKET_TTL_MS) return "expired";
  return now - ts < MIN_FILL_MS ? "too_fast" : "ok";
}

/** حدود المعدل. تعيد false عند التجاوز. */
export const limits = {
  draft: (req: Request) => hit(`golden:draft:${ipBucket(clientIp(req.headers))}`, 12, 3600),
  submit: (req: Request) => hit(`golden:submit:${ipBucket(clientIp(req.headers))}`, 8, 3600),
  email: (email: string) => hit(`golden:email:${canonicalEmail(email)}`, 4, 86_400),
};

/** بريد من فريقنا (المالك): لا ينطبق عليه منع الحجز المكرر ليجرّب الرحلة مراراً. */
export const isTeamEmail = (email: string) => getOwnerAlertEmails().some((e) => canonicalEmail(e) === canonicalEmail(email));
