import "server-only";
import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { clientIp as ipOf } from "@/lib/client-ip";
import { findSessionByToken, type SessionRow } from "./sessions";

export const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export function clientIp(req: Request): string {
  return ipOf(req.headers);
}

/** عدّاد نافذة ثابتة. عند تعطل Redis نسمح بالطلب (تجربة التاجر أهم من الحد) with تسجيل الخطأ */
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

export type Guard = { ok: true; session: SessionRow } | { ok: false; res: NextResponse };

const DEAD = {
  expired: {
    status: 410,
    message: "انتهت صلاحية الرابط. اطلب رابطاً جديداً من المحادثة وكل ما كتبته هيفضل محفوظ.",
  },
  revoked: {
    status: 410,
    message: "الرابط ده اتلغى لأن فيه رابط أحدث اتبعتلك. استخدم آخر رابط وصلك.",
  },
} as const;

/**
 * نُمرّر حالة "submitted" للأمام حتى يتمكن submitOnboarding من:
 *  - إعادة إرسال الـ Build إذا كان فاشلاً
 *  - إرجاع بيانات المتجر الحالية إذا كان مبنياً بنجاح (alreadySubmitted)
 * بدلاً من حجب المستخدم بـ 409 نهائي.
 */
export async function requireActiveSession(token: string): Promise<Guard> {
  const s = await findSessionByToken(token);
  if (!s) return { ok: false, res: json({ error: "not_found", message: "الرابط غير صحيح." }, 404) };

  if (s.status === "issued" || s.status === "draft" || s.status === "submitted") {
    return { ok: true, session: s };
  }

  const d = DEAD[s.status as keyof typeof DEAD];
  if (!d) {
    return {
      ok: false,
      res: json({ error: s.status, message: "الرابط غير صالح." }, 410),
    };
  }
  return { ok: false, res: json({ error: s.status, message: d.message }, d.status) };
}