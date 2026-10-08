// claims.ts — استلام متجر عبر رابط التفعيل.
//
// المتاجر التي تُبنى من محادثة Messenger/Instagram تُنشأ لتاجر "مؤقت" بلا حساب
// Google. رابط التفعيل (سري، يُرسل للتاجر في محادثته) هو الطريقة الوحيدة لنقل
// ملكية ذلك المتجر إلى حساب Google الذي يفتح الرابط.
//
// القاعدة: لا نقل ملكية أبداً من حساب حقيقي (له googleId) إلى حساب آخر.
import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { conversations, magicLinks, merchants, stores } from "@/db/schema";
import { sha256 } from "@/lib/ids";
import { clientEnv } from "@/lib/env";
import { log } from "@/lib/logger";
import { recordEvent } from "@/lifecycle/machine";

/** رابط التفعيل يعيش على نطاق المنصة حيث تعيش جلسة التاجر. */
export function activationUrl(token: string): string {
  return `${clientEnv.NEXT_PUBLIC_APP_URL}/claim?token=${encodeURIComponent(token)}`;
}

export type ClaimResult =
  | { ok: true; storeId: string; transferred: boolean }
  | { ok: false; reason: "invalid_or_expired" | "owned_by_another_account" };

export async function claimStoreWithActivationToken(
  token: string,
  merchantId: string
): Promise<ClaimResult> {
  const [link] = await db
    .select()
    .from(magicLinks)
    .where(
      and(
        eq(magicLinks.tokenHash, await sha256(token)),
        eq(magicLinks.purpose, "activate"),
        isNull(magicLinks.usedAt),
        gt(magicLinks.expiresAt, new Date())
      )
    )
    .limit(1);
  if (!link) return { ok: false, reason: "invalid_or_expired" };

  const [store] = await db
    .select({ id: stores.id, merchantId: stores.merchantId, subdomain: stores.subdomain })
    .from(stores)
    .where(and(eq(stores.id, link.storeId), isNull(stores.deletedAt)))
    .limit(1);
  if (!store) return { ok: false, reason: "invalid_or_expired" };

  if (store.merchantId === merchantId) {
    await db.update(magicLinks).set({ usedAt: new Date() }).where(eq(magicLinks.id, link.id));
    return { ok: true, storeId: store.id, transferred: false };
  }

  const [owner] = await db
    .select({ id: merchants.id, googleId: merchants.googleId })
    .from(merchants)
    .where(eq(merchants.id, store.merchantId))
    .limit(1);

  // المالك الحالي حساب حقيقي → لا نقل. يُسجَّل كحدث أمني.
  if (!owner || owner.googleId) {
    log.warn("security", "claim_rejected_real_owner", { merchantId, storeId: store.id });
    return { ok: false, reason: "owned_by_another_account" };
  }

  // نقل كل ما يملكه الحساب المؤقت (متاجره ومحادثاته) إلى الحساب الحقيقي ذرياً.
  const now = new Date();
  await db.batch([
    db.update(magicLinks).set({ usedAt: now }).where(eq(magicLinks.id, link.id)),
    db
      .update(stores)
      .set({ merchantId, updatedAt: now })
      .where(eq(stores.merchantId, owner.id)),
    db
      .update(conversations)
      .set({ merchantId, updatedAt: now })
      .where(eq(conversations.merchantId, owner.id)),
    db
      .update(merchants)
      .set({ isActivated: false, updatedAt: now })
      .where(eq(merchants.id, owner.id)),
  ]);

  await recordEvent({
    storeId: store.id,
    storeRef: store.subdomain,
    type: "store.claimed",
    actor: `merchant:${merchantId}`,
    data: { fromPlaceholderMerchant: owner.id },
  });
  log.info("auth", "store_claimed", { merchantId, storeId: store.id });
  return { ok: true, storeId: store.id, transferred: true };
}
