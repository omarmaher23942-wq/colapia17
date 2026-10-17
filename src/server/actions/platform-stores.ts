"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { stores, magicLinks, storeBlueprints, systemEvents, conversations } from "@/db/schema";
import { requirePlatformCap } from "@/server/platform-guard";
import { invalidateStoreCache } from "@/lib/tenant";
import { RESERVED_SUBDOMAINS } from "@/middleware";
import { secureToken, sha256 } from "@/lib/ids";
import { activationUrl } from "@/server/claims";
import { transition } from "@/lifecycle/machine";
import { notifyMerchant } from "@/ai/lifecycle/notify";
import { cancelJobs } from "@/ai/lifecycle/schedule";

const own = async () => {
  const u = await requirePlatformCap("stores.manage", "غير مصرح");
  return u;
};
const log = (storeId: string, message: string, actor: string) =>
  db.insert(systemEvents).values({ scope: "store", storeId, actor, message });
const reval = (id: string) => {
  revalidatePath(`/admin/stores/${id}`);
  revalidatePath("/admin/stores");
  revalidatePath("/admin/pipeline");
};

export async function setStoreStatusAction(storeId: string, status: "suspended" | "active" | "trial") {
  const u = await own();
  const [s] = await db.select().from(stores).where(eq(stores.id, storeId));
  if (!s) return;
  // متجر حُذفت بياناته لا يُفعَّل: لا شيء يُعاد.
  if (status !== "suspended" && (s.deletedAt || s.status === "deleted")) throw new Error("المتجر محذوف ولا يمكن تفعيله");
  const r = await transition({
    storeId,
    to: status,
    actor: `platform:${u.id}`,
    set: status === "active" ? { activatedAt: s.activatedAt ?? new Date(), frozenAt: null, purgeAt: null } : {},
    reason: "manual_status",
  });
  if (!r.ok) throw new Error(`تعذر تغيير الحالة (${r.reason}${r.current ? `: ${r.current}` : ""})`);
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