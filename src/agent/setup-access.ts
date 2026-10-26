import "server-only";
// setup-access.ts — من رمز رابط الإعداد الموقّع إلى المتجر وصاحبه (البريد يبقى على الخادم). ليس نقطة استدعاء عامة.
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { merchants, stores } from "@/db/schema";
import { env } from "@/lib/env";
import { checkLinkToken, peekLinkId } from "@/lib/link-token";
import { passwordFingerprint } from "@/server/auth";

export type SetupTarget = {
  storeId: string;
  storeName: string;
  merchantId: string;
  email: string | null;
  status: string;
  /** وُضعت كلمة المرور من قبل (رابط الإعداد يصلح لمرة واحدة). */
  hasPassword: boolean;
  trialEndsAt: Date | null;
};

export type SetupResolve = { ok: true; target: SetupTarget } | { ok: false; reason: "invalid" | "expired" };

export async function resolveSetupToken(token: unknown): Promise<SetupResolve> {
  const chk = checkLinkToken(env.AUTH_SECRET, "setup", token);
  if (!chk.ok) return chk;
  const [row] = await db
    .select({ storeId: stores.id, storeName: stores.name, merchantId: stores.merchantId, status: stores.status, trialEndsAt: stores.trialEndsAt, email: merchants.email, passwordHash: merchants.passwordHash })
    .from(stores)
    .innerJoin(merchants, eq(merchants.id, stores.merchantId))
    .where(eq(stores.id, chk.id))
    .limit(1);
  if (!row) return { ok: false, reason: "invalid" };
  const { passwordHash, ...rest } = row;
  return { ok: true, target: { ...rest, hasPassword: Boolean(passwordHash) } };
}

export type ResetTarget = { merchantId: string; email: string | null };

/** رابط إعادة التعيين: صالح فقط ما دامت بصمة كلمة المرور الحالية هي التي وُقّع بها (لمرة واحدة). */
export async function resolveResetToken(token: unknown): Promise<{ ok: true; target: ResetTarget } | { ok: false; reason: "invalid" | "expired" }> {
  const id = peekLinkId(token);
  if (!id) return { ok: false, reason: "invalid" };
  const [m] = await db.select({ id: merchants.id, email: merchants.email, passwordHash: merchants.passwordHash }).from(merchants).where(eq(merchants.id, id)).limit(1);
  if (!m) return { ok: false, reason: "invalid" };
  const chk = checkLinkToken(env.AUTH_SECRET, "reset", token, { fp: passwordFingerprint(m.passwordHash) });
  return chk.ok ? { ok: true, target: { merchantId: m.id, email: m.email } } : chk;
}
