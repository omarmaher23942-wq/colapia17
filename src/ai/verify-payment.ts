import "server-only";
import { z } from "zod";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { aiObject } from "./providers";
import { getPrompt } from "./prompts";
import { db } from "@/db/client";
import { platformPayments } from "@/db/schema";
import { env } from "@/lib/env";
import type { Verification } from "@/lifecycle/payment-policy";

const verificationOutputSchema = z.object({
  amountEgp: z.number().nullable(),
  service: z.string().nullable(),
  toNumberOrAddress: z.string().nullable(),
  fromNumber: z.string().nullable(),
  reference: z.string().nullable(),
  datetime: z.string().nullable(),
  looksEdited: z.boolean(),
  confidence: z.number().min(0).max(1),
  recommendation: z.enum(["approve", "review", "reject"]),
  reason: z.string().max(300),
});

/** يقرأ سكرين شوت الإيصال، يقارن بالسعر الرسمي ورقم المنصة، ويكشف التكرار بالـ Hash.
 *  يعيد نتيجة الفحص (أو null إن تعذّر تنزيل الصورة) ليتخذ قرار القبول الفوري. */
export async function verifyPlatformPayment(paymentId: string): Promise<Verification | null> {
  const [p] = await db
    .select()
    .from(platformPayments)
    .where(eq(platformPayments.id, paymentId));
  if (!p?.screenshotUrl) return null;

  let buf: Buffer;
  try {
    const res = await fetch(p.screenshotUrl, { signal: AbortSignal.timeout(15_000) });
    buf = Buffer.from(await res.arrayBuffer());
  } catch (e) {
    console.error("[verifyPlatformPayment] Failed to fetch screenshot:", e);
    return null;
  }

  const hash = createHash("sha256").update(buf).digest("hex");
  const [dup] = await db
    .select({ id: platformPayments.id })
    .from(platformPayments)
    .where(eq(platformPayments.screenshotHash, hash))
    .limit(1);

  // السعر الحقيقي المطلوب من إعدادات النظام الرسمية
  const officialPriceEgp = env.PLATFORM_PRICE_EGP || 899;

  const expected = {
    amountEgp: officialPriceEgp,
    to: p.method === "vodafone_cash" ? env.VODAFONE_CASH_NUMBER : env.INSTAPAY_NUMBER,
    service: p.method === "vodafone_cash" ? "Vodafone Cash" : "InstaPay",
  };

  let result: z.infer<typeof verificationOutputSchema>;
  try {
    result = await aiObject(
      "vision",
      {
        schema: verificationOutputSchema,
        system: await getPrompt("verify.payment"),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `المتوقع بالكامل: مبلغ ${expected.amountEgp} جنيه مصري محولة إلى ${expected.to} عبر خدمة ${expected.service}. الرقم المُحوِّل المسجل من التاجر: ${p.senderPhone ?? "غير مذكور"}.`,
              },
              { type: "image", image: buf },
            ],
          },
        ],
        temperature: 0,
      },
      { purpose: "verify_payment", storeId: p.storeId }
    );
  } catch (e) {
    result = {
      amountEgp: null,
      service: null,
      toNumberOrAddress: null,
      fromNumber: null,
      reference: null,
      datetime: null,
      looksEdited: false,
      confidence: 0,
      recommendation: "review",
      reason: `تعذّر التحليل الآلي: ${String(e).slice(0, 100)}`,
    };
  }

  // كشف التكرار الصارم
  if (dup && dup.id !== p.id) {
    result = {
      ...result,
      recommendation: "reject",
      reason: "نفس صورة الإيصال استُخدمت في تحويل سابق! " + result.reason,
      confidence: 1,
    };
  }

  const duplicate = !!dup && dup.id !== p.id;
  await db
    .update(platformPayments)
    .set({ screenshotHash: hash, aiVerification: { ...result, expected, duplicate } })
    .where(eq(platformPayments.id, paymentId));
  return { ...result, duplicate };
}