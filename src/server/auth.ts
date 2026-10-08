// auth.ts — جلسات التجار والعملاء ومستخدمي المنصة.
//
// قواعد العزل (لا تُكسر):
//  1) هذا الملف server-only وليس "use server": لا تُصدَّر منه أي نقطة استدعاء للمتصفح.
//     الواجهات التي يحتاجها العميل تمر عبر src/server/actions/* بعد التحقق.
//  2) المتجر النشط للتاجر يُحسم من ملكية stores.merchantId فقط. sessions.storeId مجرد
//     "اختيار" للمتجر النشط، ولا يُقبل إلا إن كان التاجر يملكه فعلاً.
//  3) جلسة العميل محصورة بمتجر واحد، وكوكيها يحمل معرّف المتجر في اسمه.
//  4) كوكي التاجر والمنصة على النطاق الجذري فقط (host-only) فلا تراها نطاقات المتاجر.
import "server-only";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { getTenantDb } from "@/db/tenant";
import {
  merchants,
  stores,
  sessions,
  platformUsers,
  customers,
  magicLinks,
} from "@/db/schema";
import { secureToken, sha256 } from "@/lib/ids";
import { clientEnv } from "@/lib/env";
import { storeUrl } from "@/lib/utils";
import { readRequestId } from "@/lib/correlation";
import { log } from "@/lib/logger";
import { sendTemplatedEmail } from "@/lib/email";

const MERCHANT_COOKIE = "clp_m";
const PLATFORM_COOKIE = "clp_p";
const CUSTOMER_COOKIE_PREFIX = "clp_c_";
const SESSION_DAYS = 30;
const MAGIC_LINK_TTL_MIN = 15;

type SubjectType = "merchant" | "platform" | "customer";
type Merchant = typeof merchants.$inferSelect;
type Store = typeof stores.$inferSelect;

// ─── الكوكيز ────────────────────────────────────────────────────────────────

function rootDomain(): string {
  return clientEnv.NEXT_PUBLIC_ROOT_DOMAIN.toLowerCase().split(":")[0] ?? "";
}

/** النطاق المشترك بين المنصة وكل المتاجر (يُستخدم لكوكي العميل فقط). */
function sharedCookieDomain(): string | undefined {
  const root = rootDomain();
  if (!root || root === "localhost" || root === "127.0.0.1") return undefined;
  return `.${root}`;
}

/** اسم كوكي العميل الخاص بمتجر معيّن: عملاء المتاجر المختلفة لا يتشاركون جلسة. */
function customerCookieName(storeId: string): string {
  return `${CUSTOMER_COOKIE_PREFIX}${storeId.replace(/-/g, "").slice(0, 16)}`;
}

async function writeCookie(name: string, token: string, domain?: string) {
  const jar = await cookies();
  jar.set(name, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    domain,
    maxAge: SESSION_DAYS * 86400,
  });
}

async function clearCookie(name: string, domain?: string) {
  const jar = await cookies();
  jar.delete({ name, path: "/", domain });
}

/**
 * الإصدارات السابقة كانت تضع كوكي التاجر والمنصة على `.root`. نحذف تلك النسخة
 * عند كل دخول/خروج حتى لا تبقى جلسة قديمة مرئية لنطاقات المتاجر.
 */
async function clearLegacySharedCookie(name: string) {
  const shared = sharedCookieDomain();
  if (shared) await clearCookie(name, shared);
}

// ─── الجلسات ────────────────────────────────────────────────────────────────

async function createSession(
  subjectType: SubjectType,
  subjectId: string,
  storeId: string | null
): Promise<string> {
  const token = secureToken();
  const h = await headers();
  const [row] = await db
    .insert(sessions)
    .values({
      tokenHash: await sha256(token),
      subjectType,
      subjectId,
      storeId,
      userAgent: h.get("user-agent")?.slice(0, 300),
      ip: h.get("x-real-ip") ?? undefined,
      expiresAt: new Date(Date.now() + SESSION_DAYS * 864e5),
    })
    .returning({ id: sessions.id });

  log.info("auth", "session_created", {
    reqId: await readRequestId(),
    userId: subjectId,
    storeId,
    sessionId: row?.id ?? null,
    subjectType,
  });
  return token;
}

async function findSession(token: string | undefined, subjectType: SubjectType) {
  if (!token) return null;
  const [s] = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.tokenHash, await sha256(token)),
        eq(sessions.subjectType, subjectType),
        gt(sessions.expiresAt, new Date())
      )
    )
    .limit(1);
  return s ?? null;
}

// ─── التاجر ─────────────────────────────────────────────────────────────────

export type GoogleIdentity = {
  email: string;
  name: string;
  googleId: string;
  picture?: string;
};

/**
 * يُستدعى من OAuth callback فقط بعد تحقق Google من الهوية والبريد.
 * يُنشئ التاجر أو يحدّثه ويبدأ جلسة جديدة على النطاق الجذري.
 */
export async function signInMerchantWithGoogle(
  identity: GoogleIdentity
): Promise<{ merchant: Merchant; isNew: boolean }> {
  const reqId = await readRequestId();
  const email = identity.email.trim().toLowerCase();
  const displayName = identity.name?.trim() || email.split("@")[0] || "تاجر جديد";

  const [byGoogle] = await db
    .select()
    .from(merchants)
    .where(eq(merchants.googleId, identity.googleId))
    .limit(1);
  const [byEmail] = byGoogle
    ? [undefined]
    : await db.select().from(merchants).where(eq(merchants.email, email)).limit(1);
  const existing = byGoogle ?? byEmail;

  let merchant: Merchant;
  let isNew = false;
  const now = new Date();

  if (existing) {
    // حساب مرتبط بـ Google آخر لا يُستولى عليه بمطابقة البريد.
    if (existing.googleId && existing.googleId !== identity.googleId) {
      log.warn("security", "merchant_google_id_mismatch", { reqId, merchantId: existing.id });
      throw new Error("google_identity_mismatch");
    }
    const [updated] = await db
      .update(merchants)
      .set({
        googleId: identity.googleId,
        email,
        avatarUrl: existing.avatarUrl ?? identity.picture ?? null,
        isActivated: true,
        lastLoginAt: now,
        updatedAt: now,
      })
      .where(eq(merchants.id, existing.id))
      .returning();
    if (!updated) throw new Error("merchant_update_failed");
    merchant = updated;
  } else {
    const [created] = await db
      .insert(merchants)
      .values({
        email,
        displayName,
        googleId: identity.googleId,
        avatarUrl: identity.picture ?? null,
        isActivated: true,
        lastLoginAt: now,
      })
      .returning();
    if (!created) throw new Error("merchant_create_failed");
    merchant = created;
    isNew = true;
  }

  const token = await createSession("merchant", merchant.id, null);
  await clearLegacySharedCookie(MERCHANT_COOKIE);
  await writeCookie(MERCHANT_COOKIE, token);
  log.info("auth", isNew ? "merchant_signup_ok" : "merchant_login_ok", {
    reqId,
    merchantId: merchant.id,
  });
  return { merchant, isNew };
}

/** كل متاجر التاجر غير المحذوفة، الأحدث أولاً. */
export async function listMerchantStores(merchantId: string): Promise<Store[]> {
  return db
    .select()
    .from(stores)
    .where(and(eq(stores.merchantId, merchantId), isNull(stores.deletedAt)))
    .orderBy(desc(stores.updatedAt));
}

export type MerchantSession = {
  sessionId: string;
  merchantId: string;
  merchant: Merchant;
  /** المتجر النشط — مضمون أن التاجر يملكه. */
  storeId: string | null;
  store: Store | null;
  /** كل متاجر التاجر (لمبدّل المتاجر). */
  stores: Store[];
} | null;

/**
 * جلسة التاجر الحالية مع متجره النشط.
 * المتجر النشط = اختيار الجلسة إن كان التاجر يملكه، وإلا أحدث متاجره.
 * لا يمكن لأي مسار أن يجعل تاجراً يرى متجراً لا يملكه.
 */
export async function getMerchantSession(): Promise<MerchantSession> {
  const jar = await cookies();
  const s = await findSession(jar.get(MERCHANT_COOKIE)?.value, "merchant");
  if (!s) return null;

  const [merchant] = await db
    .select()
    .from(merchants)
    .where(eq(merchants.id, s.subjectId))
    .limit(1);
  if (!merchant || !merchant.isActivated) return null;

  const owned = await listMerchantStores(merchant.id);
  const store = owned.find((x) => x.id === s.storeId) ?? owned[0] ?? null;

  return {
    sessionId: s.id,
    merchantId: merchant.id,
    merchant,
    storeId: store?.id ?? null,
    store,
    stores: owned,
  };
}

export type MerchantStoreSession = NonNullable<MerchantSession> & {
  storeId: string;
  store: Store;
};

export async function getMerchantStoreOrNull(): Promise<MerchantStoreSession | null> {
  const session = await getMerchantSession();
  if (!session?.store) return null;
  return session as MerchantStoreSession;
}

export async function requireMerchantStore(): Promise<MerchantStoreSession> {
  const session = await getMerchantStoreOrNull();
  if (!session) redirect("/dashboard/onboarding");
  return session;
}

/** يغيّر المتجر النشط في الجلسة الحالية بعد التحقق من الملكية. */
export async function setActiveStore(storeId: string): Promise<boolean> {
  const session = await getMerchantSession();
  if (!session) return false;
  if (!session.stores.some((s) => s.id === storeId)) {
    log.warn("security", "active_store_not_owned", {
      merchantId: session.merchantId,
      storeId,
    });
    return false;
  }
  await db
    .update(sessions)
    .set({ storeId })
    .where(eq(sessions.id, session.sessionId));
  return true;
}

// ─── المنصة ─────────────────────────────────────────────────────────────────

export async function startPlatformSession(userId: string) {
  const token = await createSession("platform", userId, null);
  await clearLegacySharedCookie(PLATFORM_COOKIE);
  await writeCookie(PLATFORM_COOKIE, token);
}

export async function getPlatformSession() {
  const jar = await cookies();
  const s = await findSession(jar.get(PLATFORM_COOKIE)?.value, "platform");
  if (!s) return null;
  const [u] = await db
    .select()
    .from(platformUsers)
    .where(and(eq(platformUsers.id, s.subjectId), eq(platformUsers.isActive, true)))
    .limit(1);
  return u ?? null;
}

export async function logout(kind: "merchant" | "platform") {
  const name = kind === "merchant" ? MERCHANT_COOKIE : PLATFORM_COOKIE;
  const jar = await cookies();
  const token = jar.get(name)?.value;
  if (token) {
    await db
      .delete(sessions)
      .where(and(eq(sessions.tokenHash, await sha256(token)), eq(sessions.subjectType, kind)));
  }
  await clearCookie(name);
  await clearLegacySharedCookie(name);
  log.info("auth", "logout_ok", { reqId: await readRequestId(), kind });
}

// ─── العميل (لكل متجر) ──────────────────────────────────────────────────────

type Customer = typeof customers.$inferSelect;

async function startCustomerSession(storeId: string, customerId: string) {
  const token = await createSession("customer", customerId, storeId);
  // نطاق مشترك لأن دخول Google يمر بالنطاق الجذري ثم يعود لنطاق المتجر،
  // والعزل مضمون باسم الكوكي الخاص بالمتجر وبشرط storeId في الجلسة.
  await writeCookie(customerCookieName(storeId), token, sharedCookieDomain());
}

export async function signInCustomerWithGoogle(
  storeId: string,
  identity: GoogleIdentity
): Promise<Customer> {
  const reqId = await readRequestId();
  const email = identity.email.trim().toLowerCase();
  const name = identity.name?.trim() || email.split("@")[0] || "عميل";

  const tdb = await getTenantDb(storeId);
  const [byGoogle] = await tdb
    .select()
    .from(customers)
    .where(and(eq(customers.storeId, storeId), eq(customers.googleId, identity.googleId)))
    .limit(1);
  const [byEmail] = byGoogle
    ? [undefined]
    : await tdb
        .select()
        .from(customers)
        .where(and(eq(customers.storeId, storeId), eq(customers.email, email)))
        .limit(1);
  const existing = byGoogle ?? byEmail;
  const now = new Date();

  let customer: Customer;
  if (existing) {
    const [updated] = await tdb
      .update(customers)
      .set({
        googleId: identity.googleId,
        avatarUrl: existing.avatarUrl ?? identity.picture ?? null,
        email: existing.email ?? email,
        name: existing.name || name,
        updatedAt: now,
      })
      .where(and(eq(customers.id, existing.id), eq(customers.storeId, storeId)))
      .returning();
    if (!updated) throw new Error("customer_update_failed");
    customer = updated;
  } else {
    const [created] = await tdb
      .insert(customers)
      .values({
        storeId,
        // رقم مؤقت فريد حتى يكمل العميل بياناته في أول طلب.
        phone: `g_${identity.googleId.slice(0, 24)}`,
        name,
        email,
        googleId: identity.googleId,
        avatarUrl: identity.picture ?? null,
      })
      .returning();
    if (!created) throw new Error("customer_create_failed");
    customer = created;
  }

  if (customer.isBlocked) {
    log.warn("auth", "customer_blocked", { reqId, storeId, userId: customer.id });
    throw new Error("customer_blocked");
  }

  await startCustomerSession(storeId, customer.id);
  return customer;
}

export type CustomerSession = {
  customerId: string;
  customer: Customer;
  storeId: string;
} | null;

export async function getCustomerSession(storeId: string): Promise<CustomerSession> {
  const jar = await cookies();
  const s = await findSession(jar.get(customerCookieName(storeId))?.value, "customer");
  if (!s || s.storeId !== storeId) return null;

  const tdb = await getTenantDb(storeId);
  const [customer] = await tdb
    .select()
    .from(customers)
    .where(and(eq(customers.id, s.subjectId), eq(customers.storeId, storeId)))
    .limit(1);
  if (!customer || customer.isBlocked) return null;

  return { customerId: customer.id, customer, storeId };
}

export async function customerLogout(storeId: string) {
  const name = customerCookieName(storeId);
  const jar = await cookies();
  const token = jar.get(name)?.value;
  if (token) {
    await db
      .delete(sessions)
      .where(
        and(
          eq(sessions.tokenHash, await sha256(token)),
          eq(sessions.subjectType, "customer"),
          eq(sessions.storeId, storeId)
        )
      );
  }
  await clearCookie(name, sharedCookieDomain());
}

/**
 * يُصدر رابط دخول سريع للعميل على نطاق متجره (صالح 15 دقيقة، استخدام واحد).
 * الرابط يُستهلك عبر /account/verify على نطاق المتجر نفسه.
 */
export async function issueCustomerMagicLink(params: {
  store: { id: string; subdomain: string; name: string };
  customerId: string;
  email: string;
  redirectAfter: string;
}): Promise<boolean> {
  const reqId = await readRequestId();
  const token = secureToken();
  try {
    await db.insert(magicLinks).values({
      tokenHash: await sha256(token),
      purpose: "customer_login",
      // العمود اسمه merchantId تاريخياً؛ هنا يحمل معرّف العميل (purpose يحدد المعنى).
      merchantId: params.customerId,
      storeId: params.store.id,
      expiresAt: new Date(Date.now() + MAGIC_LINK_TTL_MIN * 60_000),
    });

    const url = storeUrl(
      params.store.subdomain,
      `/account/verify?token=${encodeURIComponent(token)}&redirect=${encodeURIComponent(
        params.redirectAfter
      )}`
    );

    const { GenericEmail } = await import("@/lib/email-templates/GenericEmail");
    await sendTemplatedEmail({
      to: params.email,
      subject: `رابط الدخول إلى ${params.store.name}`,
      element: GenericEmail({
        storeName: params.store.name,
        headline: "تسجيل الدخول السريع",
        paragraphs: [
          `اضغط الزر للدخول إلى حسابك في ${params.store.name}. الرابط صالح ${MAGIC_LINK_TTL_MIN} دقيقة ولمرة واحدة.`,
          "لو لم تطلب هذا الرابط، تجاهل الرسالة بأمان.",
        ],
        buttons: [{ title: "تسجيل الدخول", url }],
      }),
      senderKind: "noreply",
      tracking: false,
    });
    log.info("auth", "magic_link_issued", { reqId, storeId: params.store.id, userId: params.customerId });
    return true;
  } catch (err) {
    log.error("auth", "magic_link_issue_failed", { reqId, storeId: params.store.id }, "", err);
    return false;
  }
}

/** يستهلك رابط دخول العميل ويبدأ جلسته. يُستدعى من Route Handler فقط. */
export async function consumeCustomerMagicLink(token: string, storeId: string): Promise<boolean> {
  const [link] = await db
    .update(magicLinks)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(magicLinks.tokenHash, await sha256(token)),
        eq(magicLinks.storeId, storeId),
        eq(magicLinks.purpose, "customer_login"),
        isNull(magicLinks.usedAt),
        gt(magicLinks.expiresAt, new Date())
      )
    )
    .returning();
  if (!link) return false;

  const tdb = await getTenantDb(storeId);
  const [customer] = await tdb
    .select({ id: customers.id, isBlocked: customers.isBlocked })
    .from(customers)
    .where(and(eq(customers.id, link.merchantId), eq(customers.storeId, storeId)))
    .limit(1);
  if (!customer || customer.isBlocked) return false;

  await startCustomerSession(storeId, customer.id);
  log.info("auth", "magic_link_consumed", { storeId, userId: customer.id });
  return true;
}
