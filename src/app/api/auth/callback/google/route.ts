// callback/google/route.ts — معالج OAuth callback لـ Google.
//
// التعديلات الجذرية:
// 1) كل فشل يمرّ عبر failRedirect مع reason واضح + logging منظّم.
// 2) redirectAfter محفوظ بأمان ولا يمكن استخدامه لـ open redirect.
// 3) نُلحق reqId في searchParams ليستخدمه الـ login dashboard في عرض مرجعي.
// 4) [جديد] Auto-provisioning للمالكين: أي إيميل في PLATFORM_OWNER_EMAILS
//    يتم إنشاؤه أو تفعيله تلقائياً بصفة owner عند أول تسجيل دخول.
//    الحل دائم — لا يحتاج SQL يدوي لأي مسؤول مستقبلي.
// 5) لا دخول للمشترين: الدخول للتاجر وفريق المنصة فقط.
import { safeInternalPath } from "@/lib/safe-redirect";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { platformUsers, stores } from "@/db/schema";
import { verifyDerivedToken } from "@/agent/tokens";
import { verifyGoogleCode } from "@/server/google-oauth";
import {
  signInMerchantWithGoogle,
  startPlatformSession,
} from "@/server/auth";
import { consumeOAuthState } from "@/server/oauth-state";
import { readRequestId } from "@/lib/correlation";
import { log } from "@/lib/logger";
import { getPlatformOwnerEmails } from "@/lib/env";

export const dynamic = "force-dynamic";

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * يعيد المستخدم إلى صفحة الدخول المناسبة برمز السبب الحقيقي (error) والوجهة الأصلية (redirect) ليُكمل بعد التصحيح.
 * الأسباب يترجمها LoginForm إلى رسائل عربية؛ المرجع (req) للدعم.
 */
function failRedirect(req: Request, reason: string, opts: { provider?: "merchant" | "platform"; redirect?: string; reqId: string; extra?: Record<string, string> }) {
  const base = opts.provider === "platform" ? "/admin/login" : "/login";
  const url = new URL(base, req.url);
  url.searchParams.set("error", reason);
  if (opts.redirect && opts.provider !== "platform") url.searchParams.set("redirect", opts.redirect);
  url.searchParams.set("req", opts.reqId);
  if (opts.extra) for (const [k, v] of Object.entries(opts.extra)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

function safeRedirectAfter(input: string | undefined, fallback: string) {
  return safeInternalPath(input, fallback);
}

// ─── Platform admin resolution (auto-provisioning) ────────────────────────
async function resolvePlatformAdmin(params: {
  email: string;
  name: string;
  googleId: string;
  picture?: string | null;
  reqId: string;
}): Promise<typeof platformUsers.$inferSelect | null> {
  const email = params.email.toLowerCase().trim();

  // 1) نحاول إيجاد مستخدم مُفعَّل بالفعل.
  const [active] = await db
    .select()
    .from(platformUsers)
    .where(and(eq(platformUsers.email, email), eq(platformUsers.isActive, true)))
    .limit(1);
  if (active) {
    // عضو أضافه المالك بالبريد: أول دخول بـ Google يكمل حسابه (الصورة وآخر دخول).
    await db
      .update(platformUsers)
      .set({ lastLoginAt: new Date(), avatarUrl: params.picture ?? active.avatarUrl, updatedAt: new Date() })
      .where(eq(platformUsers.id, active.id))
      .catch(() => {});
    return active;
  }

  // 2) هل الإيميل في قائمة المالكين المُفَوَّضين تلقائياً؟
  const ownerEmails = getPlatformOwnerEmails();
  if (!ownerEmails.includes(email)) {
    log.warn("auth", "oauth_platform_unauthorized", { reqId: params.reqId }, email);
    return null;
  }

  // 3) موجود لكن مُعطَّل؟ → نُفعِّله ونجعله owner.
  const [inactive] = await db
    .select()
    .from(platformUsers)
    .where(eq(platformUsers.email, email))
    .limit(1);

  if (inactive) {
    const [reactivated] = await db
      .update(platformUsers)
      .set({
        isActive: true,
        role: "owner",
        name: inactive.name || params.name || email.split("@")[0]!,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(platformUsers.id, inactive.id))
      .returning();
    log.info("auth", "platform_owner_reactivated", {
      reqId: params.reqId,
      userId: inactive.id,
    });
    return reactivated ?? null;
  }

  // 4) غير موجود نهائياً → ننشئه بصفة owner تلقائياً.
  const [created] = await db
    .insert(platformUsers)
    .values({
      email,
      name: params.name || email.split("@")[0]!,
      passwordHash: `google-oauth-${crypto.randomUUID()}`,
      role: "owner",
      isActive: true,
      lastLoginAt: new Date(),
    })
    .returning();

  log.info("auth", "platform_owner_auto_provisioned", {
    reqId: params.reqId,
    userId: created?.id,
  });
  return created ?? null;
}

// ─── Main handler ──────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const reqId = await readRequestId();
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error");

    if (oauthError) {
      log.warn("auth", "oauth_provider_error", { reqId }, oauthError);
      return failRedirect(req, `provider_${oauthError}`, { reqId });
    }
    if (!code || !stateParam) {
      log.warn("auth", "oauth_missing_params", { reqId });
      return failRedirect(req, "missing_params", { reqId });
    }

    const state = await consumeOAuthState(stateParam);
    if (!state) {
      log.warn("auth", "oauth_invalid_state", { reqId });
      return failRedirect(req, "invalid_state", { reqId });
    }

    const ctx = { provider: state.provider, redirect: state.redirectAfter, reqId } as const;
    const user = await verifyGoogleCode(code);
    if (!user.email || !user.id) {
      log.warn("auth", "oauth_no_email", { reqId });
      return failRedirect(req, "no_email", ctx);
    }
    if (!user.emailVerified) {
      log.warn("security", "oauth_unverified_email", { reqId });
      return failRedirect(req, "email_not_verified", ctx);
    }
    const identity = {
      email: user.email,
      name: user.name,
      googleId: user.id,
      picture: user.picture,
    };

    // ─── Merchant ───────────────────────────────────────────────────────
    if (state.provider === "merchant") {
      // دخول من رابط الإعداد: مقيّد بصاحب ذلك المتجر، ويُختار متجره في الجلسة.
      let expectMerchantId: string | undefined;
      let storeId: string | undefined;
      if (state.setupToken) {
        const sid = verifyDerivedToken("setup", state.setupToken);
        const [st] = sid ? await db.select({ id: stores.id, merchantId: stores.merchantId }).from(stores).where(eq(stores.id, sid)).limit(1) : [];
        if (!st) return failRedirect(req, "invalid_state", ctx);
        expectMerchantId = st.merchantId;
        storeId = st.id;
      }
      let signed: Awaited<ReturnType<typeof signInMerchantWithGoogle>>;
      try {
        signed = await signInMerchantWithGoogle(identity, { expectMerchantId, storeId });
      } catch (e) {
        if ((e as Error)?.message === "google_identity_mismatch") return failRedirect(req, "google_identity_mismatch", ctx);
        throw e;
      }
      if (!signed) {
        // لا متجر مرتبط بهذا الحساب: من الرابط يعود لصفحة الإعداد (تعرض البريد المتوقع مخفياً)، وإلا شاشة الدخول اللطيفة.
        if (state.setupToken) return NextResponse.redirect(new URL(`/setup?t=${encodeURIComponent(state.setupToken)}&error=wrong_account`, req.url));
        return failRedirect(req, "no_store", ctx);
      }
      const { merchant, isNew } = signed;
      const to = safeRedirectAfter(state.redirectAfter, "/dashboard");
      log.info("auth", "oauth_merchant_ok", {
        reqId,
        merchantId: merchant.id,
        isNew,
        redirectTo: to,
      });
      return NextResponse.redirect(new URL(to, req.url));
    }

    // ─── Platform Admin ─────────────────────────────────────────────────
    if (state.provider === "platform") {
      const adminUser = await resolvePlatformAdmin({
        email: user.email,
        name: user.name ?? "",
        googleId: user.id,
        picture: user.picture,
        reqId,
      });

      if (!adminUser) {
        return failRedirect(req, "unauthorized", { provider: "platform", reqId });
      }

      await startPlatformSession(adminUser.id);
      const to = safeRedirectAfter(state.redirectAfter, "/admin");
      log.info("auth", "oauth_platform_ok", { reqId, userId: adminUser.id });
      return NextResponse.redirect(new URL(to, req.url));
    }

    log.warn("auth", "oauth_unsupported_provider", { reqId }, state.provider);
    return failRedirect(req, "unsupported_provider", { reqId });
  } catch (err) {
    log.error(
      "auth",
      "oauth_callback_crashed",
      { reqId },
      "استثناء غير متوقع في callback جوجل",
      err
    );
    return failRedirect(req, "server_error", { reqId });
  }
}