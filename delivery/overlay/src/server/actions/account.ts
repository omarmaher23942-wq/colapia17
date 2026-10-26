"use server";

// account.ts (مشروعك الخاص) — حساب صاحب المتجر: صورته الشخصية، وتغيير كلمة المرور. لا حذف متجر من هنا.
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { merchants } from "@/db/schema";
import { getMerchantSession, setOwnerPassword, startOwnerSession } from "@/server/auth";
import { verifyPassword } from "@/server/passwords";
import { allow } from "@/lib/ratelimit";
import { isHostedImage } from "@/lib/media-hosts";

type Result = { ok: true } | { ok: false; error: string };

export async function setAvatarAction(url: string | null): Promise<Result> {
  const s = await getMerchantSession();
  if (!s) return { ok: false, error: "انتهت الجلسة، سجّلوا الدخول من جديد" };
  const v = url === null ? null : String(url).trim();
  if (v !== null && (!/^https:\/\//.test(v) || !isHostedImage(v))) return { ok: false, error: "ارفعوا الصورة من الزر نفسه" };
  try {
    await db.update(merchants).set({ avatarUrl: v, updatedAt: new Date() }).where(eq(merchants.id, s.merchantId));
    revalidatePath("/dashboard", "layout");
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: "تعذر حفظ الصورة، حاولوا مرة أخرى" };
  }
}

const passwordInput = z.object({ current: z.string().min(1).max(200), next: z.string().min(10, "كلمة المرور 10 أحرف على الأقل").max(200) });

/** يغيّر كلمة المرور بعد التحقق من الحالية. كل الجلسات الأخرى تنتهي، وتبقى هذه الجلسة. */
export async function changePasswordAction(raw: unknown): Promise<Result> {
  const s = await getMerchantSession();
  if (!s?.storeId) return { ok: false, error: "انتهت الجلسة، سجّلوا الدخول من جديد" };
  const p = passwordInput.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "بيانات غير صالحة" };
  if (!(await allow("login", `pw:${s.merchantId}`))) return { ok: false, error: "محاولات كثيرة. انتظروا دقائق ثم أعيدوا المحاولة." };
  if (!s.merchant.passwordHash || !(await verifyPassword(p.data.current, s.merchant.passwordHash))) return { ok: false, error: "كلمة المرور الحالية غير صحيحة" };
  try {
    await setOwnerPassword(s.merchantId, p.data.next);
    await startOwnerSession(s.merchantId, s.storeId);
    revalidatePath("/dashboard", "layout");
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: "تعذر تغيير كلمة المرور، حاولوا مرة أخرى" };
  }
}
