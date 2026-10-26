"use server";
import { revalidatePath } from "next/cache";
import { requirePlatformCap } from "@/server/platform-guard";
import { confirmPayment, rejectPayment, revokePayment } from "@/lifecycle/payments";

function refresh() {
  revalidatePath("/admin/payments");
  revalidatePath("/admin/requests");
  revalidatePath("/admin/edits");
  revalidatePath("/admin");
}

/** قرار المالك على تحويل عميل (حجز مشروع أو رسوم تعديل): تأكيد يدخل الإنتاج أو يبدأ التعديل، أو رفض بسبب يصل العميل. */
export async function decidePaymentAction(id: string, d: "confirm" | "reject", note?: string) {
  const u = await requirePlatformCap("payments.decide", "غير مصرح بقرارات الدفع");
  if (d === "confirm") await confirmPayment(id, u.id, note);
  else await rejectPayment(id, u.id, note?.trim() || "لم نتمكن من التحقق من التحويل");
  refresh();
}

/** إلغاء تأكيد قُبل ثم تبيّن بعد مراجعة الحساب أن التحويل لم يصل أو غير صحيح. */
export async function revokePaymentAction(id: string, note: string) {
  const u = await requirePlatformCap("payments.decide", "غير مصرح بقرارات الدفع");
  const reason = note.trim().slice(0, 300);
  if (reason.length < 3) throw new Error("اكتبوا سبب الإلغاء ليصل للعميل");
  await revokePayment(id, u.id, reason);
  refresh();
}
