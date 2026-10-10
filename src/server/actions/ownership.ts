"use server";

// "امتلك متجرك": إجراءات لوحة التاجر على المنصة.
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { stores } from "@/db/schema";
import { invalidateStoreCache } from "@/lib/tenant";
import { log } from "@/lib/logger";
import { getMerchantStoreOrNull } from "@/server/auth";
import { allow } from "@/lib/ratelimit";
import { issueTransferCode, latestTransfer, purgeStore } from "@/server/ownership/transfer";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export type OwnershipLive = {
  transfer: { status: string; siteUrl: string | null; lastSeenAt: string | null; expiresAt: string } | null;
  ownedUrl: string | null;
  ownedAt: string | null;
};

export async function issueTransferCodeAction(): Promise<Result<{ code: string; expiresAt: string }>> {
  const s = await getMerchantStoreOrNull();
  if (!s) return { ok: false, error: "غير مصرح" };
  if (s.store.status !== "active") return { ok: false, error: "فعّل متجرك أولاً من صفحة الفوترة." };
  if (s.store.ownedAt) return { ok: false, error: "استلمت متجرك بالفعل." };
  if (!(await allow("ownership", `code:${s.storeId}`))) return { ok: false, error: "طلبات كثيرة، انتظر دقائق" };
  const { code, expiresAt } = await issueTransferCode(s.storeId);
  return { ok: true, data: { code, expiresAt: expiresAt.toISOString() } };
}

export async function ownershipLiveAction(): Promise<Result<OwnershipLive>> {
  const s = await getMerchantStoreOrNull();
  if (!s) return { ok: false, error: "غير مصرح" };
  const t = await latestTransfer(s.storeId);
  if (s.store.ownedAt) revalidatePath("/dashboard", "layout");
  return {
    ok: true,
    data: {
      transfer: t
        ? { status: t.status, siteUrl: t.siteUrl, lastSeenAt: t.lastSeenAt?.toISOString() ?? null, expiresAt: t.expiresAt.toISOString() }
        : null,
      ownedUrl: s.store.ownedUrl,
      ownedAt: s.store.ownedAt?.toISOString() ?? null,
    },
  };
}

// ── بعد النقل: التاجر يقرر وحده (قرار المالك 2026-10-10) ──
// النقل لا يوقف شيئاً ولا يحذف شيئاً: نسخة المنصة تبقى تعمل طوال اشتراكه. هذان الزران اختياريان تماماً،
// ولا يلغيان اشتراكه: إن أوقف نسخته أو حذف بياناته يبقى اشتراكه سارياً حتى نهاية سنته ولا يُستردّ منه شيء.

async function transferred() {
  const s = await getMerchantStoreOrNull();
  if (!s) return { error: "غير مصرح" as const };
  if (!s.store.ownedAt || !s.store.ownedUrl) return { error: "هذا الإجراء بعد أن تنقل متجرك لموقعك وتتأكد أنه يعمل." as const };
  if (s.store.purgedAt) return { error: "حُذفت بيانات متجرك من المنصة بالفعل." as const };
  return { s };
}

/** إيقاف نسخة المتجر على المنصة الآن: الزائر يُحوَّل لموقعك الجديد، والبيانات تبقى محفوظة وتعود بزر «أعد التشغيل». */
export async function stopPlatformCopyAction(): Promise<Result<null>> {
  const g = await transferred();
  if ("error" in g) return { ok: false, error: g.error! };
  const [row] = await db.update(stores).set({ platformOfflineAt: new Date(), updatedAt: new Date() }).where(eq(stores.id, g.s.storeId)).returning();
  if (row) await invalidateStoreCache(row).catch(() => {});
  log.info("store", "platform_copy_stopped", { storeId: g.s.storeId });
  revalidatePath("/dashboard", "layout");
  return { ok: true, data: null };
}

export async function resumePlatformCopyAction(): Promise<Result<null>> {
  const g = await transferred();
  if ("error" in g) return { ok: false, error: g.error! };
  const [row] = await db.update(stores).set({ platformOfflineAt: null, updatedAt: new Date() }).where(eq(stores.id, g.s.storeId)).returning();
  if (row) await invalidateStoreCache(row).catch(() => {});
  log.info("store", "platform_copy_resumed", { storeId: g.s.storeId });
  revalidatePath("/dashboard", "layout");
  return { ok: true, data: null };
}

/**
 * حذف كل بيانات المتجر وصوره من المنصة نهائياً (لا رجعة فيه). يشترط كتابة رابط المتجر تأكيداً،
 * ويُوقف نسخة المنصة معه. صف المتجر والتاجر وسجل الدفع يبقون (إثبات الاشتراك، وتحويل رابطك القديم لموقعك الجديد).
 */
export async function deleteMyPlatformDataAction(confirm: string): Promise<Result<null>> {
  const g = await transferred();
  if ("error" in g) return { ok: false, error: g.error! };
  if (confirm.trim().toLowerCase() !== g.s.store.subdomain.toLowerCase()) return { ok: false, error: "اكتب رابط متجرك كما هو لتأكيد الحذف." };
  if (!(await allow("ownership", `purge:${g.s.storeId}`))) return { ok: false, error: "طلبات كثيرة، انتظر دقائق" };
  const done = await purgeStore(g.s.store);
  if (!done) return { ok: false, error: "تعذّر الحذف الآن، لم يُحذف شيء كاملاً. حاول بعد قليل." };
  const [row] = await db.update(stores).set({ platformOfflineAt: new Date(), updatedAt: new Date() }).where(eq(stores.id, g.s.storeId)).returning();
  if (row) await invalidateStoreCache(row).catch(() => {});
  log.info("store", "platform_data_deleted_by_owner", { storeId: g.s.storeId });
  revalidatePath("/dashboard", "layout");
  return { ok: true, data: null };
}
