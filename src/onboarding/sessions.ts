// onboarding/sessions.ts — إدارة جلسات استمارة بناء المتجر.
//
// السبب الجذري لإصلاح onboardingUrl:
// النسخة السابقة كانت ترسل المستخدم إلى /login?redirect=/onboarding/{token}،
// لكن /login — بحكم منطق "المستخدم مسجّل → وجّهه للداشبورد" — تعترضه وتعيده
// إلى /dashboard، فتضيع رحلة الاستمارة بالكامل بصمت. بعد نجاح OAuth callback
// لا معنى لإعادة تسجيل الدخول — نرسل التاجر مباشرة إلى /onboarding/{token}.
import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { onboardingSessions } from "@/db/schema";
import { clientEnv, env } from "@/lib/env";
import { generateToken, hashToken, isWellFormedToken } from "./token";

export type SessionRow = typeof onboardingSessions.$inferSelect;

const RESUMABLE = ["issued", "draft", "expired"] as const;
const ttlMs = () => env.ONBOARDING_LINK_TTL_DAYS * 864e5;

// الرابط المباشر — التاجر مسجّل بالفعل من OAuth callback، فلا داعي لـ /login.
export const onboardingUrl = (token: string): string =>
  `${clientEnv.NEXT_PUBLIC_APP_URL}/onboarding/${token}`;

// رابط بديل — لحالة "messenger flow" حيث المستخدم لا يمتلك جلسة بعد.
export const onboardingLoginUrl = (token: string): string =>
  `${clientEnv.NEXT_PUBLIC_APP_URL}/login?redirect=${encodeURIComponent(
    `/onboarding/${token}`
  )}`;

const isActive = (r: Pick<SessionRow, "status">) =>
  r.status === "issued" || r.status === "draft";

export async function issueOnboardingSession(
  conversationId: string
): Promise<{ url: string; sessionId: string; resumed: boolean }> {
  const candidates = await db
    .select()
    .from(onboardingSessions)
    .where(
      and(
        eq(onboardingSessions.conversationId, conversationId),
        inArray(onboardingSessions.status, [...RESUMABLE])
      )
    )
    .orderBy(desc(onboardingSessions.updatedAt))
    .limit(10);

  const active = candidates.find(isActive) ?? null;
  const source = active ?? candidates[0] ?? null;

  if (active) {
    await db
      .update(onboardingSessions)
      .set({ status: "revoked", updatedAt: new Date() })
      .where(eq(onboardingSessions.id, active.id));
  }

  const { token, hash } = generateToken();
  const resumed = !!source && source.draftVersion > 0;

  try {
    const [row] = await db
      .insert(onboardingSessions)
      .values({
        conversationId,
        tokenHash: hash,
        status: resumed ? "draft" : "issued",
        expiresAt: new Date(Date.now() + ttlMs()),
        ...(resumed && source
          ? {
              draft: source.draft,
              draftVersion: source.draftVersion,
              lastStep: source.lastStep,
            }
          : {}),
      })
      .returning({ id: onboardingSessions.id });

    if (!row) throw new Error("onboarding session insert returned no row");
    return { url: onboardingUrl(token), sessionId: row.id, resumed };
  } catch (e) {
    // استرجاع أفضل-جهد للحالة القديمة إن كان هناك جلسة نشطة سابقة.
    if (active) {
      await db
        .update(onboardingSessions)
        .set({ status: active.status, updatedAt: new Date() })
        .where(eq(onboardingSessions.id, active.id))
        .catch(() => {});
    }
    throw e;
  }
}

export async function findSessionByToken(token: string): Promise<SessionRow | null> {
  if (!isWellFormedToken(token)) return null;

  const [row] = await db
    .select()
    .from(onboardingSessions)
    .where(eq(onboardingSessions.tokenHash, hashToken(token)))
    .limit(1);

  if (!row) return null;

  if (
    (row.status === "issued" || row.status === "draft") &&
    row.expiresAt.getTime() < Date.now()
  ) {
    await db
      .update(onboardingSessions)
      .set({ status: "expired", updatedAt: new Date() })
      .where(eq(onboardingSessions.id, row.id));
    return { ...row, status: "expired" };
  }

  return row;
}