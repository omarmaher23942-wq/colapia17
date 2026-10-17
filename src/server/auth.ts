// auth.ts — جلسات التجار ومستخدمي المنصة (لا حسابات للمشترين: ميزاتهم على أجهزتهم).
//
// قواعد العزل (لا تُكسر):
//  1) هذا الملف server-only وليس "use server": لا تُصدَّر منه أي نقطة استدعاء للمتصفح.
//     الواجهات التي يحتاجها العميل تمر عبر src/server/actions/* بعد التحقق.
//  2) المتجر النشط للتاجر يُحسم من ملكية stores.merchantId فقط. sessions.storeId مجرد
//     "اختيار" للمتجر النشط، ولا يُقبل إلا إن كان التاجر يملكه فعلاً.
//  3) كوكي التاجر والمنصة على النطاق الجذري فقط (host-only) فلا تراها نطاقات المتاجر.
import "server-only";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  merchants,
  stores,
  sessions,
  platformUsers,
  storeMembers,
} from "@/db/schema";
import { NO_PERMS, OWNER_PERMS, permsFor, type StorePerms } from "@/lib/store-perms";
import { secureToken, sha256 } from "@/lib/ids";
import { clientEnv } from "@/lib/env";
import { readRequestId } from "@/lib/correlation";
import { clientIp } from "@/lib/client-ip";
import { log } from "@/lib/logger";

const MERCHANT_COOKIE = "clp_m";
const PLATFORM_COOKIE = "clp_p";
const SESSION_DAYS = 30;

type SubjectType = "merchant" | "platform";
type Merchant = typeof merchants.$inferSelect;
type Store = typeof stores.$inferSelect;

// ─── الكوكيز ────────────────────────────────────────────────────────────────

function rootDomain(): string {
  return clientEnv.NEXT_PUBLIC_ROOT_DOMAIN.toLowerCase().split(":")[0] ?? "";
}

/** النطاق المشترك بين المنصة وكل المتاجر (لحذف كوكيز الإصدارات القديمة فقط). */
function sharedCookieDomain(): string | undefined {
  const root = rootDomain();
  if (!root || root === "localhost" || root === "127.0.0.1") return undefined;
  return `.${root}`;
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
      ip: clientIp(h),
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

  await linkMemberships(merchant.id, email);
  const token = await createSession("merchant", merchant.id, null);
  await clearLegacySharedCookie(MERCHANT_COOKIE);
  await writeCookie(MERCHANT_COOKIE, token);
  log.info("auth", isNew ? "merchant_signup_ok" : "merchant_login_ok", {
    reqId,
    merchantId: merchant.id,
  });
  return { merchant, isNew };
}

/** دعوات فريق المتجر بهذا البريد تُربط بهوية التاجر عند دخوله (Google أو رمز البريد). */
async function linkMemberships(merchantId: string, email: string) {
  await db
    .update(storeMembers)
    .set({ merchantId, updatedAt: new Date() })
    .where(and(eq(storeMembers.email, email.trim().toLowerCase()), isNull(storeMembers.merchantId), eq(storeMembers.status, "active")))
    .catch((e) => log.warn("auth", "link_memberships_failed", {}, String(e)));
}

/**
 * يبدأ جلسة تاجر لبريد تحقق منه رمز لمرة واحدة (بديل Google لمن لا يملك حساباً). يُسمح فقط لبريد تاجر موجود
 * (صاحب متجر من الاستمارة) أو عضو فريق مدعو؛ لا إنشاء حسابات جديدة من هنا. يعيد null إن لم يكن البريد معروفاً.
 */
export async function signInMerchantByEmail(rawEmail: string): Promise<{ merchant: Merchant } | null> {
  const email = rawEmail.trim().toLowerCase();
  const now = new Date();
  let [merchant] = await db.select().from(merchants).where(eq(merchants.email, email)).limit(1);
  if (!merchant) {
    const [invite] = await db
      .select({ id: storeMembers.id })
      .from(storeMembers)
      .where(and(eq(storeMembers.email, email), eq(storeMembers.status, "active")))
      .limit(1);
    if (!invite) return null;
    [merchant] = await db.insert(merchants).values({ email, displayName: email.split("@")[0] || "عضو فريق", isActivated: true, lastLoginAt: now }).returning();
    if (!merchant) return null;
  } else {
    [merchant] = await db.update(merchants).set({ isActivated: true, lastLoginAt: now, updatedAt: now }).where(eq(merchants.id, merchant.id)).returning();
    if (!merchant) return null;
  }
  await linkMemberships(merchant.id, email);
  const token = await createSession("merchant", merchant.id, null);
  await clearLegacySharedCookie(MERCHANT_COOKIE);
  await writeCookie(MERCHANT_COOKIE, token);
  log.info("auth", "merchant_login_email_ok", { reqId: await readRequestId(), merchantId: merchant.id });
  return { merchant };
}

/** كل متاجر التاجر غير المحذوفة (التي يملكها)، الأحدث أولاً. */
export async function listMerchantStores(merchantId: string): Promise<Store[]> {
  return db
    .select()
    .from(stores)
    .where(and(eq(stores.merchantId, merchantId), isNull(stores.deletedAt)))
    .orderBy(desc(stores.updatedAt));
}

type Membership = { storeId: string; memberId: string; role: string; perms: StorePerms };

/** المتاجر التي هو عضو في فريقها (عضوية نشطة) بصلاحياتها. */
async function listMemberships(merchantId: string): Promise<{ stores: Store[]; byStore: Map<string, Membership> }> {
  const rows = await db
    .select({ store: stores, m: storeMembers })
    .from(storeMembers)
    .innerJoin(stores, eq(stores.id, storeMembers.storeId))
    .where(and(eq(storeMembers.merchantId, merchantId), eq(storeMembers.status, "active"), isNull(stores.deletedAt)))
    .catch(() => []);
  return {
    stores: rows.map((r) => r.store),
    byStore: new Map(rows.map((r) => [r.store.id, { storeId: r.store.id, memberId: r.m.id, role: r.m.role, perms: permsFor(r.m.role, r.m.perms) }])),
  };
}

export type MerchantSession = {
  sessionId: string;
  merchantId: string;
  merchant: Merchant;
  /** المتجر النشط — مضمون أن التاجر يملكه أو عضو نشط في فريقه. */
  storeId: string | null;
  store: Store | null;
  /** كل متاجره (يملكها أو عضو فيها) لمبدّل المتاجر. */
  stores: Store[];
  /** علاقته بالمتجر النشط وصلاحياته فيه (صاحب المتجر = كل شيء). */
  access: "owner" | "member";
  perms: StorePerms;
  memberId: string | null;
} | null;

/**
 * جلسة التاجر الحالية مع متجره النشط.
 * المتجر النشط = اختيار الجلسة إن كان يملكه أو عضواً فيه، وإلا أحدث متاجره.
 * لا يمكن لأي مسار أن يجعل تاجراً يرى متجراً لا يملكه ولا عضوية له فيه.
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

  const [owned, member] = await Promise.all([listMerchantStores(merchant.id), listMemberships(merchant.id)]);
  const all = [...owned, ...member.stores.filter((m) => !owned.some((o) => o.id === m.id))];
  const store = all.find((x) => x.id === s.storeId) ?? all[0] ?? null;
  const isOwner = Boolean(store && owned.some((o) => o.id === store.id));
  const membership = store && !isOwner ? member.byStore.get(store.id) : undefined;

  return {
    sessionId: s.id,
    merchantId: merchant.id,
    merchant,
    storeId: store?.id ?? null,
    store,
    stores: all,
    access: isOwner || !store ? "owner" : "member",
    perms: isOwner || !store ? OWNER_PERMS : (membership?.perms ?? NO_PERMS),
    memberId: membership?.memberId ?? null,
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
  if (!session) redirect("/start");
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
