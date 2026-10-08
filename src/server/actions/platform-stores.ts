"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { stores, magicLinks, storeBlueprints, systemEvents, conversations } from "@/db/schema";
import { getPlatformSession } from "@/server/auth";
import { invalidateStoreCache } from "@/lib/tenant";
import { RESERVED_SUBDOMAINS } from "@/middleware";
import { secureToken, sha256 } from "@/lib/ids";
import { activationUrl } from "@/server/claims";
import { notifyMerchant } from "@/ai/lifecycle/notify";
import { cancelJobs } from "@/ai/lifecycle/schedule";
import { releaseToBuild } from "@/lifecycle/release";

const own = async () => {
  const u = await getPlatformSession();
  if (!u || u.role === "reviewer") throw new Error("غير مصرح");
  return u;
};
const log = (storeId: string, message: string, actor: string) =>
  db.insert(systemEvents).values({ scope: "store", storeId, actor, message });
const reval = (id: string) => {
  revalidatePath(`/admin/stores/${id}`);
  revalidatePath("/admin/stores");
  revalidatePath("/admin/pipeline");
};

/**
 * إعادة بناء متجر من لوحة الأونر. تُغلّف releaseToBuild بحيث تُعيد نتيجة
 * واضحة بدل رَمي استثناء. هذا يمنع 500 error في صفحة إدارة المتجر.
 */
export async function rebuildStoreAction(
  storeId: string
): Promise<
  | { ok: true; jobId: string }
  | { ok: false; error: string }
> {
  const u = await own();
  try {
    const result = await releaseToBuild(storeId, `platform:${u.id}`);
    if (result.started) {
      await log(storeId, "إعادة بناء المتجر من لوحة الأونر", `platform:${u.id}`);
      reval(storeId);
      return { ok: true, jobId: result.jobId };
    }

    // رسائل مفهومة لكل سبب
    const messages: Record<typeof result.reason, string> = {
      not_found: "المتجر غير موجود",
      not_allowed: `حالة المتجر الحالية (${result.current}) لا تسمح بإعادة البناء`,
      stale: "البحث توقف — حاول مرة أخرى",
      already_running: "البناء جارٍ بالفعل — انتظر انتهاءه أو أعد المحاولة بعد قليل",
      no_data: "لا توجد بيانات كافية للبناء (intake مفقود)",
      start_failed: "فشل بدء البناء — أعد المحاولة بعد دقيقة",
    };
    return { ok: false, error: messages[result.reason] };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "خطأ غير متوقع",
    };
  }
}

export async function setStoreStatusAction(storeId: string, status: "suspended" | "active" | "trial") {
  const u = await own();
  const [s] = await db.select().from(stores).where(eq(stores.id, storeId));
  if (!s) return;
  await db
    .update(stores)
    .set({
      status,
      updatedAt: new Date(),
      ...(status === "active"
        ? { activatedAt: s.activatedAt ?? new Date(), frozenAt: null, purgeAt: null }
        : {}),
    })
    .where(eq(stores.id, storeId));
  if (status === "active") {
    await cancelJobs(storeId, [
      "trial.freeze",
      "trial.last_chance",
      "trial.purge",
      "trial.reminder_20h",
      "trial.reminder_6h",
    ]);
    await db
      .update(conversations)
      .set({ stage: "activated" })
      .where(eq(conversations.storeId, storeId));
  }
  await invalidateStoreCache(s);
  await log(storeId, `تغيير الحالة ${s.status} → ${status}`, `platform:${u.id}`);
  reval(storeId);
}

export async function changeSubdomainAction(storeId: string, sub: string) {
  const u = await own();
  sub = sub.toLowerCase().trim();
  if (!/^[a-z0-9-]{3,30}$/.test(sub) || RESERVED_SUBDOMAINS.has(sub))
    return { error: "اسم غير صالح أو محجوز (3 إلى 30 حرفًا لاتينيًا أو رقمًا أو -)" };
  const [dup] = await db
    .select({ id: stores.id })
    .from(stores)
    .where(eq(stores.subdomain, sub));
  if (dup && dup.id !== storeId) return { error: "الرابط مستخدم بالفعل" };
  const [s] = await db.select().from(stores).where(eq(stores.id, storeId));
  if (!s) return { error: "متجر غير موجود" };
  await invalidateStoreCache(s);
  await db
    .update(stores)
    .set({ subdomain: sub, updatedAt: new Date() })
    .where(eq(stores.id, storeId));
  await log(storeId, `تغيير الرابط ${s.subdomain} → ${sub}`, `platform:${u.id}`);
  reval(storeId);
  return {};
}

export async function resendMagicLinkAction(storeId: string) {
  const u = await own();
  const [s] = await db.select().from(stores).where(eq(stores.id, storeId));
  if (!s) return;
  const token = secureToken();
  await db.insert(magicLinks).values({
    tokenHash: await sha256(token),
    purpose: "activate",
    merchantId: s.merchantId,
    storeId,
    expiresAt: new Date(Date.now() + 48 * 36e5),
  });
  await notifyMerchant(
    storeId,
    "ده رابط جديد لإنشاء حسابك في لوحة التحكم (صالح 48 ساعة) 👇",
    {
      buttons: [
        { title: "إنشاء حسابي", url: activationUrl(token) },
      ],
      tag: "ACCOUNT_UPDATE",
    }
  );
  await log(storeId, "إعادة إرسال Magic Link", `platform:${u.id}`);
}

export async function exportBlueprintAction(storeId: string) {
  await own();
  const [b] = await db
    .select()
    .from(storeBlueprints)
    .where(eq(storeBlueprints.storeId, storeId));
  return JSON.stringify(b?.data ?? {}, null, 2);
}

export async function toggleShowcaseAction(storeId: string, v: boolean) {
  await own();
  await db
    .update(stores)
    .set({ showcaseOptIn: v })
    .where(eq(stores.id, storeId));
  revalidatePath("/");
  reval(storeId);
}

export async function toggleAcceptingAction(storeId: string, v: boolean) {
  const u = await own();
  const [s] = await db.select().from(stores).where(eq(stores.id, storeId));
  if (!s) return;
  await db
    .update(stores)
    .set({ acceptingOrders: v, updatedAt: new Date() })
    .where(eq(stores.id, storeId));
  await invalidateStoreCache(s);
  await log(storeId, v ? "استقبال الطلبات مفعّل" : "وضع الإجازة", `platform:${u.id}`);
  reval(storeId);
}

export async function softDeleteStoreAction(storeId: string) {
  const u = await own();
  const [s] = await db.select().from(stores).where(eq(stores.id, storeId));
  if (!s) return;
  await cancelJobs(storeId, [
    "delivery.auto",
    "trial.reminder_6h",
    "trial.reminder_20h",
    "trial.freeze",
    "trial.last_chance",
    "trial.purge",
  ]);
  await db
    .update(stores)
    .set({ status: "deleted", deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(stores.id, storeId));
  await invalidateStoreCache(s);
  await log(storeId, "حذف منطقي من المالك", `platform:${u.id}`);
  revalidatePath("/admin/stores");
  revalidatePath("/admin/pipeline");
}