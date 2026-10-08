"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { merchants, systemEvents } from "@/db/schema";
import { getPlatformSession } from "@/server/auth";
import { sendEmail } from "@/lib/email";
import { revalidatePath } from "next/cache";
import { sleep } from "@/lib/utils";

async function requireAdmin() {
  const session = await getPlatformSession();
  if (!session) {
    throw new Error("غير مصرح: هذه العملية مخصصة لإدارة منصة كولابيا فقط");
  }
  return session;
}

/** إرسال إيميل رسمي فردي لتاجر محدد */
export async function sendIndividualEmailAction({
  merchantId,
  subject,
  headline,
  content,
  buttonTitle,
  buttonUrl,
}: {
  merchantId: string;
  subject: string;
  headline?: string;
  content: string;
  buttonTitle?: string;
  buttonUrl?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin = await requireAdmin();

    const [merchant] = await db
      .select({ email: merchants.email, name: merchants.displayName })
      .from(merchants)
      .where(eq(merchants.id, merchantId))
      .limit(1);

    if (!merchant || !merchant.email) {
      return { ok: false, error: "التاجر لا يملك بريداً إلكترونياً مسجلاً" };
    }

    const paragraphs = content.split(/\n+/).filter((p) => p.trim().length > 0);

    const success = await sendEmail({
      to: merchant.email,
      subject,
      headline: headline || subject,
      paragraphs,
      buttons: buttonTitle && buttonUrl ? [{ title: buttonTitle, url: buttonUrl }] : undefined,
      storeName: "Colapia",
    });

    if (!success) {
      return { ok: false, error: "فشل إرسال الإيميل عبر خادم Resend" };
    }

    await db.insert(systemEvents).values({
      scope: "admin",
      actor: `platform:${admin.id}`,
      message: `تم إرسال إيميل رسمي للتاجر ${merchant.name} (${merchant.email})`,
      data: { subject, merchantId },
    });

    return { ok: true };
  } catch (err: any) {
    console.error("[sendIndividualEmailAction] Error:", err);
    return { ok: false, error: err?.message || "حدث خطأ أثناء إرسال الإيميل" };
  }
}

/** إرسال إيميل برودكاست جماعي لكل التجار مع احترام Rate Limit مزود الخدمة */
export async function sendBroadcastEmailAction({
  subject,
  headline,
  content,
  buttonTitle,
  buttonUrl,
}: {
  subject: string;
  headline?: string;
  content: string;
  buttonTitle?: string;
  buttonUrl?: string;
}): Promise<{ ok: boolean; sentCount?: number; error?: string }> {
  try {
    const admin = await requireAdmin();

    const rows = await db
      .select({ email: merchants.email })
      .from(merchants);

    const validEmails = Array.from(
      new Set(
        rows
          .map((r) => r.email?.trim().toLowerCase())
          .filter((e): e is string => Boolean(e && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)))
      )
    );

    if (!validEmails.length) {
      return { ok: false, error: "لا يوجد تجار مسجلون بإيميلات صالحة حالياً" };
    }

    const paragraphs = content.split(/\n+/).filter((p) => p.trim().length > 0);

    let sentCount = 0;

    // إرسال تسلسلي بمعدل لا يتجاوز 2 إيميل بالثانية احتراماً لحدود باقة Resend المجانية
    for (const email of validEmails) {
      const ok = await sendEmail({
        to: email,
        subject,
        headline: headline || subject,
        paragraphs,
        buttons: buttonTitle && buttonUrl ? [{ title: buttonTitle, url: buttonUrl }] : undefined,
        storeName: "Colapia",
      });

      if (ok) sentCount++;
      await sleep(550); // فاصل زمني يضمن عدم تجاوز 2 طلب بالثانية
    }

    await db.insert(systemEvents).values({
      scope: "admin",
      actor: `platform:${admin.id}`,
      message: `تم إرسال برودكاست جماعي لـ ${sentCount} من إجمالي ${validEmails.length} تاجر`,
      data: { subject, totalAttempted: validEmails.length, sentCount },
    });

    revalidatePath("/admin");
    return { ok: true, sentCount };
  } catch (err: any) {
    console.error("[sendBroadcastEmailAction] Error:", err);
    return { ok: false, error: err?.message || "فشل إرسال البرودكاست الجماعي" };
  }
}