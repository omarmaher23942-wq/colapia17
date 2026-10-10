"use server";

// account.ts — حساب التاجر في المنصة: صورته الشخصية، وحذف متجر التجربة نهائياً بطلبه.
// نسخة مشروع التاجر (template/src/server/actions/account.ts) لها نفس الواجهة: تغيير كلمة المرور بدل Google،
// ولا حذف (الموقع موقعه على حساباته).
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { merchants, platformPayments } from "@/db/schema";
import { getMerchantSession, getMerchantStoreOrNull } from "@/server/auth";
import { isHostedImage } from "@/lib/media-hosts";
import { transition } from "@/lifecycle/machine";
import { purgeStore } from "@/server/ownership/transfer";
import { log } from "@/lib/logger";

type Result = { ok: true } | { ok: false; error: string };

/** الصورة الشخصية بعد رفعها لمساحة المنصة (رابط من مساحة الرفع فقط). */
export async function setAvatarAction(url: string | null): Promise<Result> {
  const s = await getMerchantSession();
  if (!s) return { ok: false, error: "انتهت جلستك، سجّل الدخول من جديد" };
  const v = url === null ? null : String(url).trim();
  if (v !== null && (!/^https:\/\//.test(v) || !isHostedImage(v))) return { ok: false, error: "ارفع الصورة من الزر نفسه" };
  try {
    await db.update(merchants).set({ avatarUrl: v, updatedAt: new Date() }).where(eq(merchants.id, s.merchantId));
    revalidatePath("/dashboard", "layout");
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: "تعذر حفظ الصورة، حاول مرة أخرى" };
  }
}

/** في المنصة الدخول بـ Google، فلا كلمة مرور تُغيَّر (الواجهة لا تعرض هذا الخيار هنا). */
export async function changePasswordAction(_raw: unknown): Promise<Result> {
  return { ok: false, error: "حسابك يدخل بـ Google، ولا كلمة مرور له" };
}

/** حالات يمكن للتاجر حذف متجره فيها بنفسه: قبل الدفع (التجربة وما بعدها). المدفوع يُستلم ثم يُحذف من المنصة. */
const DELETABLE = ["review", "trial", "frozen"] as const;

const deleteInput = z.object({ confirm: z.string().trim().min(1).max(80) });

/**
 * حذف المتجر نهائياً بطلب صاحبه: يُغلق فوراً (حالة «محذوف» تلغي كل المهام المجدولة)، ثم تُمسح كل بياناته من قاعدة
 * المنصة (منتجات، طلبات، عملاء، تصميم…) وصوره من مساحة الرفع (purgeStore، نفس ما يحدث بعد الاستلام).
 * يتطلب كتابة اسم المتجر كما هو، ويُرفض إن كان عنده إيصال دفع قيد المراجعة.
 */
export async function deleteStoreAction(raw: unknown): Promise<Result> {
  const s = await getMerchantStoreOrNull();
  if (!s) return { ok: false, error: "انتهت جلستك، سجّل الدخول من جديد" };
  const p = deleteInput.safeParse(raw);
  if (!p.success || p.data.confirm !== s.store.name.trim()) return { ok: false, error: "اكتب اسم المتجر كما هو بالضبط للتأكيد" };
  if (!(DELETABLE as readonly string[]).includes(s.store.status)) {
    return { ok: false, error: s.store.status === "active" ? "متجرك مدفوع ولا يُحذف من هنا. بعد نقل نسخة منه لحساباتك يمكنك حذف بياناتك من صفحة «امتلك متجرك»" : "لا يمكن حذف المتجر في حالته الحالية" };
  }
  const [pending] = await db
    .select({ id: platformPayments.id })
    .from(platformPayments)
    .where(and(eq(platformPayments.storeId, s.storeId), inArray(platformPayments.status, ["under_review", "confirmed"])))
    .limit(1);
  if (pending) return { ok: false, error: "عندك إيصال دفع لهذا المتجر؛ انتظر مراجعته أو تواصل معنا قبل الحذف" };

  try {
    const r = await transition({ storeId: s.storeId, to: "deleted", from: [...DELETABLE], actor: `merchant:${s.merchantId}`, set: { deletedAt: new Date() }, reason: "merchant_request" });
    if (!r.ok) return { ok: false, error: "تغيّرت حالة المتجر للتو؛ أعد تحميل الصفحة وحاول مرة أخرى" };
    const purged = await purgeStore(r.store);
    log.info("store", "merchant_deleted_store", { storeId: s.storeId, merchantId: s.merchantId, purged });
    revalidatePath("/dashboard", "layout");
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e);
    log.error("store", "merchant_delete_failed", { storeId: s.storeId }, "", e);
    return { ok: false, error: "تعذر حذف المتجر، حاول مرة أخرى" };
  }
}
