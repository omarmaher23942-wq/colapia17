import "server-only";
// upload-ticket.ts — تذكرة رفع موقّعة (HMAC): ما وافقت عليه خطوة الإذن (المسار، المفتاح، النوع، الحد، بيانات ما بعد
// الرفع) يعود مع خطوة التأكيد بلا تخزين وبلا ثقة في المتصفح. صالحة 15 دقيقة.
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import type { MediaRoute } from "@/lib/media";

export type UploadTicket = { r: MediaRoute; k: string; t: string; s: number; m: Record<string, string | number | null>; e: number };

const sign = (body: string) => createHmac("sha256", `${env.AUTH_SECRET}:upload`).update(body).digest("base64url");

export function issueTicket(t: Omit<UploadTicket, "e">, ttlMs = 15 * 60_000): string {
  const body = Buffer.from(JSON.stringify({ ...t, e: Date.now() + ttlMs })).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readTicket(raw: unknown): UploadTicket | null {
  if (typeof raw !== "string" || raw.length > 4000) return null;
  const [body, mac] = raw.split(".");
  if (!body || !mac) return null;
  const want = Buffer.from(sign(body));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const t = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as UploadTicket;
    return typeof t.e === "number" && t.e > Date.now() ? t : null;
  } catch {
    return null;
  }
}
