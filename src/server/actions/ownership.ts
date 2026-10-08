"use server";

// "امتلك متجرك": إجراءات لوحة التاجر على المنصة.
import { revalidatePath } from "next/cache";
import { getMerchantStoreOrNull } from "@/server/auth";
import { allow } from "@/lib/ratelimit";
import { issueTransferCode, latestTransfer } from "@/server/ownership/transfer";

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
