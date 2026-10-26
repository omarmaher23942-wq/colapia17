"use server";

// actions/auth.ts (مشروعك الخاص) — الملف الشخصي لصاحب المتجر والخروج.
import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { merchants } from "@/db/schema";
import { logout, getMerchantSession } from "@/server/auth";
import { normalizeEgyptianPhone } from "@/lib/phone";

const ProfileSchema = z.object({
  displayName: z.string().trim().min(2, "الاسم حرفان على الأقل").max(80, "الاسم 80 حرفاً على الأكثر"),
  phone: z
    .string()
    .trim()
    .transform((v) => (v ? normalizeEgyptianPhone(v) : ""))
    .refine((v) => v !== null, "رقم موبايل مصري من 11 رقماً يبدأ بـ 01"),
});

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; fieldErrors?: undefined; error?: undefined }
  | { ok: false; error: string; fieldErrors?: Record<string, string>; data?: undefined };

export async function updateMerchantProfileAction(formData: FormData): Promise<ActionResult> {
  const session = await getMerchantSession();
  if (!session) return { ok: false, error: "انتهت الجلسة، سجّلوا الدخول من جديد." };

  const parsed = ProfileSchema.safeParse({
    displayName: String(formData.get("displayName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form");
      if (!fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { ok: false, error: "بعض الحقول تحتاج مراجعة", fieldErrors };
  }

  const { displayName, phone } = parsed.data;
  try {
    await db.update(merchants).set({ displayName, phone: phone || null, updatedAt: new Date() }).where(eq(merchants.id, session.merchantId));
    revalidatePath("/dashboard", "layout");
    return { ok: true, data: undefined };
  } catch (err) {
    unstable_rethrow(err);
    return { ok: false, error: "تعذر حفظ التغييرات. أعيدوا المحاولة بعد لحظات." };
  }
}

export async function merchantLogoutAction(): Promise<void> {
  await logout("merchant");
  redirect("/login");
}

/** مشروعك فيه متجر واحد: لا تبديل (يبقى للواجهة المشتركة StoreSwitcher). */
export async function switchStoreAction(_storeId: string): Promise<ActionResult> {
  return { ok: false, error: "مشروعك فيه متجر واحد" };
}
