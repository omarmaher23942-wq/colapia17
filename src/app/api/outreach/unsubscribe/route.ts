// /api/outreach/unsubscribe?e=&t= — إيقاف رسائل المالك التسويقية لهذا البريد (برابط موقّع في كل رسالة).
import { timingSafeEqual } from "node:crypto";
import { db } from "@/db/client";
import { emailOptouts } from "@/db/schema";
import { unsubscribeToken } from "@/server/outreach";

export const dynamic = "force-dynamic";

const page = (title: string, body: string) =>
  new Response(
    `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="font-family:system-ui,sans-serif;background:#f4f5f8;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px"><main style="background:#fff;border-radius:16px;padding:28px;max-width:420px;text-align:center;box-shadow:0 8px 30px rgb(0 0 0/.08)"><h1 style="font-size:20px;margin:0 0 8px">${title}</h1><p style="color:#555;line-height:1.8;margin:0">${body}</p></main></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
  );

export async function GET(req: Request) {
  const u = new URL(req.url);
  const email = (u.searchParams.get("e") ?? "").trim().toLowerCase();
  const t = u.searchParams.get("t") ?? "";
  const expected = email ? unsubscribeToken(email) : "";
  const valid = email.includes("@") && t.length === expected.length && timingSafeEqual(Buffer.from(t), Buffer.from(expected));
  if (!valid) return page("الرابط غير صالح", "افتح الرابط من الرسالة نفسها كما هو.");
  await db.insert(emailOptouts).values({ email }).onConflictDoNothing();
  return page("تم إيقاف الرسائل", "لن تصلك رسائل تسويقية من Colapia بعد الآن. رسائل متجرك وطلباتك المهمة تستمر كالمعتاد.");
}
