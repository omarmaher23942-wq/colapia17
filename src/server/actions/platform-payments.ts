"use server";
import { revalidatePath } from "next/cache";
import { getPlatformSession } from "@/server/auth";
import { confirmStorePayment, rejectStorePayment, revokeStorePayment } from "@/lifecycle/payments";

export async function decidePaymentAction(id: string, d: "confirm" | "reject", note?: string) {
  const u = await getPlatformSession();
  if (!u || u.role === "reviewer") throw new Error("غير مصرح بقرارات الدفع");
  if (d === "confirm") await confirmStorePayment(id, u.id, note);
  else await rejectStorePayment(id, u.id, note?.trim() || "لم نتمكن من التحقق من التحويل");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/pipeline");
  revalidatePath("/admin");
}

/** إلغاء تفعيل قُبل فورياً بعد مراجعته (التحويل لم يصل أو غير صحيح). */
export async function revokePaymentAction(id: string, note: string) {
  const u = await getPlatformSession();
  if (!u || u.role === "reviewer") throw new Error("غير مصرح بقرارات الدفع");
  const reason = note.trim().slice(0, 300);
  if (reason.length < 3) throw new Error("اكتب سبب الإلغاء ليصل للتاجر");
  await revokeStorePayment(id, u.id, reason);
  revalidatePath("/admin/payments");
  revalidatePath("/admin");
}
