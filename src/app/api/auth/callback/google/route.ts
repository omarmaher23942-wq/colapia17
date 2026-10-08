// callback/google/route.ts — معالج OAuth callback لـ Google.
//
// التعديلات الجذرية:
// 1) كل فشل يمرّ عبر failRedirect مع reason واضح + logging منظّم.
// 2) redirectAfter محفوظ بأمان ولا يمكن استخدامه لـ open redirect.
// 3) نُلحق reqId في searchParams ليستخدمه الـ login dashboard في عرض مرجعي.
// 4) [جديد] Auto-provisioning للمالكين: أي إيميل في PLATFORM_OWNER_EMAILS
//    يتم إنشاؤه أو تفعيله تلقائياً بصفة owner عند أول تسجيل دخول.
//    الحل دائم — لا يحتاج SQL يدوي لأي مسؤول مستقبلي.
// 5) عميل المتجر يُعاد إلى نطاق متجره بعد الدخول.
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { platformUsers } from "@/db/schema";
import { verifyGoogleCode } from "@/server/google-oauth";
import {
  signInMerchantWithGoogle,
  signInCustomerWithGoogle,
  startPlatformSession,
} from "@/server/auth";
import { consumeOAuthState } from "@/server/oauth-state";
import { requireStore } from "@/lib/tenant";
import { storeUrl } from "@/lib/utils";
import { readRequestId } from "@/lib/correlation";
import { log } from "@/lib/logger";
import { getPlatformOwnerEmails } from "@/lib/env";

export const dynamic = "force-dynamic";

// ─── Helpers ───────────────────────────────────────────────────────────────

function failRedirect(
  req: Request,
  reason: string,
  to = "/",
  reqId: string,
  extra?: Record<string, string>
) {
  const url = new URL(to, req.url);
  url.searchParams.set("error", "google_auth_failed");
  url.searchParams.set("reason", reason);
  url.searchParams.set("req", reqId);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
  }
  return NextResponse.redirect(url);
}

function safeRedirectAfter(input: string | undefined, fallback: string) {
  if (!input) return fallback;
  if (!input.startsWith("/") || input.startsWith("//")) return fallback;
  return input;
}

// ─── Platform admin resolution (auto-provisioning) ────────────────────────
async function resolvePlatformAdmin(params: {
  email: string;
  name: string;
  googleId: string;
  reqId: string;
}): Promise<typeof platformUsers.$inferSelect | null> {
  const email = params.email.toLowerCase().trim();

  // 1) نحاول إيجاد مستخدم مُفعَّل بالفعل.
  const [active] = await db
    .select()
    .from(platformUsers)
    .where(and(eq(platformUsers.email, email), eq(platformUsers.isActive, true)))
    .limit(1);
  if (active) return active;

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
      return failRedirect(req, `provider_${oauthError}`, "/", reqId);
    }
    if (!code || !stateParam) {
      log.warn("auth", "oauth_missing_params", { reqId });
      return failRedirect(req, "missing_params", "/", reqId);
    }

    const state = await consumeOAuthState(stateParam);
    if (!state) {
      log.warn("auth", "oauth_invalid_state", { reqId });
      return failRedirect(req, "invalid_state", "/login", reqId);
    }

    const user = await verifyGoogleCode(code);
    if (!user.email || !user.id) {
      log.warn("auth", "oauth_no_email", { reqId });
      return failRedirect(req, "no_email", "/login", reqId);
    }
    if (!user.emailVerified) {
      log.warn("security", "oauth_unverified_email", { reqId });
      return failRedirect(req, "email_not_verified", "/login", reqId);
    }
    const identity = {
      email: user.email,
      name: user.name,
      googleId: user.id,
      picture: user.picture,
    };

    // ─── Merchant ───────────────────────────────────────────────────────
    if (state.provider === "merchant") {
      const { merchant, isNew } = await signInMerchantWithGoogle(identity);
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
        reqId,
      });

      if (!adminUser) {
        return failRedirect(req, "unauthorized", "/admin/login", reqId);
      }

      await startPlatformSession(adminUser.id);
      const to = safeRedirectAfter(state.redirectAfter, "/admin");
      log.info("auth", "oauth_platform_ok", { reqId, userId: adminUser.id });
      return NextResponse.redirect(new URL(to, req.url));
    }

    // ─── Customer (storefront) ──────────────────────────────────────────
    if (state.provider === "customer") {
      const sub = state.storeSubdomain;
      if (!sub) {
        log.warn("auth", "oauth_customer_missing_store", { reqId });
        return failRedirect(req, "missing_store", "/", reqId);
      }

      const store = await requireStore(sub).catch(() => null);
      if (!store) {
        log.warn("auth", "oauth_customer_store_not_found", { reqId }, sub);
        return failRedirect(req, "store_not_found", "/", reqId);
      }

      const customer = await signInCustomerWithGoogle(store.id, identity);

      const path = safeRedirectAfter(state.redirectAfter, "/account");
      // نبني الـ URL على النطاق الفرعي (colapia.com/account غير موجود).
      const destination = storeUrl(store.subdomain, path);

      log.info("auth", "oauth_customer_ok", {
        reqId,
        storeId: store.id,
        userId: customer.id,
        redirectTo: destination,
      });
      return NextResponse.redirect(destination);
    }

    log.warn("auth", "oauth_unsupported_provider", { reqId }, state.provider);
    return failRedirect(req, "unsupported_provider", "/", reqId);
  } catch (err) {
    log.error(
      "auth",
      "oauth_callback_crashed",
      { reqId },
      "استثناء غير متوقع في callback جوجل",
      err
    );
    return failRedirect(req, "server_error", "/", reqId);
  }
}