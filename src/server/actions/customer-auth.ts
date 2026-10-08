"use server";

// server/actions/customer-auth.ts — Server Actions لحساب المشتري في متجر معيّن.
// كل إجراء يحسم المتجر من النطاق الفرعي، وجلسة العميل محصورة بذلك المتجر.
import { redirect, unstable_rethrow } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { customers } from "@/db/schema";
import { requireStore } from "@/lib/tenant";
import { customerLogout, issueCustomerMagicLink } from "@/server/auth";
import { getGoogleAuthUrl } from "@/server/google-oauth";
import { encodeOAuthState } from "@/server/oauth-state";
import { rateLimit, clientIp } from "@/onboarding/guard";
import { headers } from "next/headers";
import { log } from "@/lib/logger";
import { readRequestId } from "@/lib/correlation";

export async function customerLogoutBySubdomain(subdomain: string) {
  const store = await requireStore(subdomain);
  if (!store) return { ok: false as const };
  await customerLogout(store.id);
  return { ok: true as const };
}

export async function initiateCustomerGoogleAuth(
  subdomain: string,
  redirectAfter: string = "/account"
) {
  const store = await requireStore(subdomain);
  if (!store) redirect("/?error=store_not_found");

  const safeRedirect =
    redirectAfter.startsWith("/") && !redirectAfter.startsWith("//")
      ? redirectAfter
      : "/account";

  const state = await encodeOAuthState({
    provider: "customer",
    storeSubdomain: subdomain,
    redirectAfter: safeRedirect,
  });

  const url = getGoogleAuthUrl(state);
  redirect(url);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function requestMagicLinkAction(
  subdomain: string,
  input: { email: string; redirectAfter?: string }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const reqId = await readRequestId();
    const store = await requireStore(subdomain);
    if (!store) return { ok: false, error: "المتجر غير موجود" };

    const email = input.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return { ok: false, error: "بريد إلكتروني غير صحيح" };
    }

    const h = await headers();
    const ip = clientIp({ headers: h } as unknown as Request);
    if (!(await rateLimit(`ml:ip:${ip}`, 5, 600))) {
      return { ok: false, error: "محاولات كثيرة، انتظر بضع دقائق" };
    }

    const db = await getTenantDb(store.id);
    const [customer] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.storeId, store.id), eq(customers.email, email)))
      .limit(1);

    if (!customer) {
      log.info("auth", "magic_link_customer_not_found", {
        reqId,
        storeId: store.id,
      });
      return { ok: true };
    }

    if (customer.isBlocked) {
      return { ok: false, error: "هذا الحساب موقوف" };
    }

    const safeRedirect =
      input.redirectAfter &&
      input.redirectAfter.startsWith("/") &&
      !input.redirectAfter.startsWith("//")
        ? input.redirectAfter
        : "/account";

    const issued = await issueCustomerMagicLink({
      store: { id: store.id, subdomain: store.subdomain, name: store.name },
      customerId: customer.id,
      email,
      redirectAfter: safeRedirect,
    });

    if (!issued) {
      return { ok: false, error: "تعذّر إصدار الرابط، حاول بعد قليل" };
    }

    return { ok: true };
  } catch (err) {
    unstable_rethrow(err);
    log.error(
      "auth",
      "magic_link_action_failed",
      { reqId: undefined },
      "فشل طلب magic link",
      err
    );
    return { ok: false, error: "حدث خطأ، حاول مجدداً" };
  }
}
