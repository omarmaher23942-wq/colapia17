"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { stores, magicLinks, merchants, storeBlueprints, systemEvents, conversations } from "@/db/schema";
import { resetLink, setupLink } from "@/agent/tokens";
import { passwordFingerprint } from "@/server/auth";
import { requirePlatformCap } from "@/server/platform-guard";
import { invalidateStoreCache } from "@/lib/tenant";
import { clientEnv } from "@/lib/env";
import { storeEntry } from "@/stores/resolve";
import { validateSubdomain } from "@/lib/subdomain-change";
import { isSubdomainHeld } from "@/server/subdomain-hold";
import { renameStoreSubdomain } from "@/server/subdomain-apply";
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

export async function changeSubdomainAction(storeId: string, raw: string) {
  const u = await own();
  const [s] = await db.select().from(stores).where(eq(stores.id, storeId));
  if (!s) return { error: "متجر غير موجود" };
  // نفس قواعد تغيير التاجر: صيغة وحجز وتفرد، والرابط القديم يحوّل للجديد 30 يوماً ولا يأخذه متجر آخر.
  const v = validateSubdomain(String(raw ?? ""), s.subdomain, clientEnv.NEXT_PUBLIC_ROOT_DOMAIN);
  if (!v.ok) return { error: v.error };
  const [dup] = await db.select({ id: stores.id }).from(stores).where(eq(stores.subdomain, v.value));
  if (dup && dup.id !== storeId) return { error: "الرابط مستخدم بالفعل" };
  if (storeEntry(v.value)) return { error: "الرابط محجوز لتصميم مخصص" };
  if (await isSubdomainHeld(v.value, storeId)) return { error: "الرابط محجوز مؤقتاً لمتجر غيّر رابطه" };
  const done = await renameStoreSubdomain(s, v.value);
  if (!done.ok) return { error: done.error };
  await log(storeId, `تغيير الرابط ${s.subdomain} → ${v.value}`, `platform:${u.id}`);
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
    "هذا رابط جديد للدخول إلى لوحة تحكم متجركم وربطه بحسابكم، وهو صالح 48 ساعة.",
    {
      buttons: [
        { title: "الدخول إلى اللوحة", url: activationUrl(token) },
      ],
      tag: "ACCOUNT_UPDATE",
    }
  );
  await log(storeId, "إعادة إرسال Magic Link", `platform:${u.id}`);
}

/**
 * «أعيدوا إرسال رابط إعداد»: رابط جديد يُنسخ ويرسله الفريق يدوياً. قبل وضع كلمة المرور = رابط الإعداد (14 يوماً)،
 * وبعدها = رابط إعادة تعيين كلمة المرور (يومان، لمرة واحدة) لمن تعذّر عليه البريد.
 */
export async function reissueSetupLinkAction(storeId: string): Promise<{ url: string; kind: "setup" | "reset" } | { error: string }> {
  const u = await own();
  const [row] = await db.select({ id: stores.id, merchantId: stores.merchantId, pw: merchants.passwordHash }).from(stores).innerJoin(merchants, eq(merchants.id, stores.merchantId)).where(eq(stores.id, storeId)).limit(1);
  if (!row) return { error: "المتجر غير موجود" };
  const out = row.pw ? { url: resetLink(row.merchantId, passwordFingerprint(row.pw)), kind: "reset" as const } : { url: setupLink(row.id), kind: "setup" as const };
  await log(storeId, out.kind === "setup" ? "توليد رابط إعداد جديد" : "توليد رابط إعادة تعيين كلمة المرور", `platform:${u.id}`);
  return out;
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