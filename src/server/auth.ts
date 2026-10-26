// auth.ts — جلسات التجار ومستخدمي المنصة (لا حسابات للمشترين: ميزاتهم على أجهزتهم).
//
// قواعد العزل (لا تُكسر):
//  1) هذا الملف server-only وليس "use server": لا تُصدَّر منه أي نقطة استدعاء للمتصفح.
//     الواجهات التي يحتاجها العميل تمر عبر src/server/actions/* بعد التحقق.
//  2) المتجر النشط للتاجر يُحسم من ملكية stores.merchantId فقط. sessions.storeId مجرد
//     "اختيار" للمتجر النشط، ولا يُقبل إلا إن كان التاجر يملكه فعلاً.
//  3) كوكي التاجر والمنصة على النطاق الجذري فقط (host-only) فلا تراها نطاقات المتاجر.
import "server-only";
import { cache } from "react";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
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
import { canonicalEmail } from "@/lib/contact";
import { hashPassword, verifyPassword } from "@/server/passwords";
import { redis } from "@/lib/redis";
import { createLockout, type CounterStore } from "@/lib/login-lockout";

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

/** هل لهذا البريد دعوة فريق نشطة في أي متجر (مطابقة بالبريد القانوني)؟ */
async function hasActiveInvite(email: string): Promise<boolean> {
  const canonical = canonicalEmail(email);
  const rows = await db
    .select({ email: storeMembers.email })
    .from(storeMembers)
    .where(and(eq(storeMembers.status, "active"), isNull(storeMembers.merchantId)))
    .limit(500)
    .catch(() => [] as { email: string }[]);
  return rows.some((r) => canonicalEmail(r.email) === canonical);
}

/** التاجر الذي يطابق هذا البريد: بالبريد القانوني (يتجاوز نقاط Gmail ووسوم +) ثم بالبريد الحرفي للسجلات القديمة. */
async function findMerchantByEmail(email: string): Promise<Merchant | null> {
  const canonical = canonicalEmail(email);
  const [m] = await db
    .select()
    .from(merchants)
    .where(or(eq(merchants.emailCanonical, canonical), eq(merchants.email, email)))
    .orderBy(desc(merchants.createdAt))
    .limit(1);
  return m ?? null;
}

/** دعوات فريق المتجر بهذا البريد تُربط بهوية التاجر عند دخوله (Google أو رمز البريد). */
async function linkMemberships(merchantId: string, email: string) {
  const canonical = canonicalEmail(email);
  const open = await db
    .select({ id: storeMembers.id, email: storeMembers.email })
    .from(storeMembers)
    .where(and(isNull(storeMembers.merchantId), eq(storeMembers.status, "active")))
    .limit(500)
    .catch(() => [] as { id: string; email: string }[]);
  for (const m of open.filter((r) => canonicalEmail(r.email) === canonical)) {
    await db
      .update(storeMembers)
      .set({ merchantId, updatedAt: new Date() })
      .where(and(eq(storeMembers.id, m.id), isNull(storeMembers.merchantId)))
      .catch((e) => log.warn("auth", "link_memberships_failed", {}, String(e)));
  }
}

const lockout = createLockout(redis as unknown as CounterStore, "pwf");
const lockId = (email: string) => canonicalEmail(email);
// تجزئة وهمية لمعادلة زمن الرد حين لا يوجد حساب بالبريد (فلا يُكشف الفرق بين «لا حساب» و«كلمة خاطئة»).
const DUMMY_HASH = "00000000000000000000000000000000:310000:0000000000000000000000000000000000000000000000000000000000000000";

export type PasswordLogin = { ok: true; merchantId: string } | { ok: false; reason: "invalid" | "locked" };

/**
 * دخول صاحب المتجر أو عضو فريقه ببريده وكلمة مروره (لا Google للتجار). قفل مؤقت بعد خمس محاولات خاطئة متتالية على البريد نفسه،
 * والرد واحد لـ«لا حساب» و«كلمة خاطئة». الجلسة تُنشأ فقط عند النجاح.
 */
export async function signInMerchantWithPassword(rawEmail: string, password: string, opts: { storeId?: string } = {}): Promise<PasswordLogin> {
  const email = rawEmail.trim().toLowerCase();
  if (await lockout.isLocked(lockId(email))) return { ok: false, reason: "locked" };
  const merchant = await findMerchantByEmail(email);
  const good = await verifyPassword(password, merchant?.passwordHash ?? DUMMY_HASH);
  if (!merchant || !merchant.passwordHash || !good) {
    const f = await lockout.fail(lockId(email));
    log.warn("security", "merchant_password_failed", { reqId: await readRequestId() });
    return f.locked ? { ok: false, reason: "locked" } : { ok: false, reason: "invalid" };
  }
  await lockout.clear(lockId(email));
  await startMerchantSession(merchant, email, opts.storeId ?? null);
  return { ok: true, merchantId: merchant.id };
}

async function startMerchantSession(merchant: Merchant, email: string, storeId: string | null) {
  const now = new Date();
  await db.update(merchants).set({ isActivated: true, emailCanonical: merchant.emailCanonical ?? canonicalEmail(merchant.email ?? email), lastLoginAt: now, updatedAt: now }).where(eq(merchants.id, merchant.id));
  await linkMemberships(merchant.id, email);
  const token = await createSession("merchant", merchant.id, storeId);
  await clearLegacySharedCookie(MERCHANT_COOKIE);
  await writeCookie(MERCHANT_COOKIE, token);
  log.info("auth", "merchant_login_password_ok", { reqId: await readRequestId(), merchantId: merchant.id });
}

/**
 * أول كلمة مرور من رابط الإعداد: تُضبط مرة واحدة فقط (`password_hash IS NULL` في نفس الـ UPDATE)، ثم تبدأ الجلسة على متجره.
 * يعيد false إن سبق ضبطها (رابط مستعمل).
 */
export async function setFirstPasswordAndSignIn(merchantId: string, password: string, storeId: string): Promise<boolean> {
  const hash = await hashPassword(password);
  const [m] = await db
    .update(merchants)
    .set({ passwordHash: hash, isActivated: true, updatedAt: new Date() })
    .where(and(eq(merchants.id, merchantId), isNull(merchants.passwordHash)))
    .returning();
  if (!m) return false;
  await startMerchantSession(m, m.email ?? "", storeId);
  return true;
}

/**
 * كلمة مرور جديدة بعد التحقق من الهوية خارج هذه الدالة (رمز البريد أو رابط إعادة تعيين من الفريق): للتاجر القائم، أو لعضو فريق
 * مدعو لم يُنشأ له حساب بعد. بريد غير معروف ← null. يمسح قفل المحاولات، وتبدأ جلسة جديدة.
 */
export async function resetPasswordAndSignIn(rawEmail: string, password: string): Promise<{ merchantId: string } | null> {
  const email = rawEmail.trim().toLowerCase();
  let merchant: Merchant | null | undefined = await findMerchantByEmail(email);
  const hash = await hashPassword(password);
  const now = new Date();
  if (!merchant) {
    if (!(await hasActiveInvite(email))) return null;
    [merchant] = await db.insert(merchants).values({ email, emailCanonical: canonicalEmail(email), displayName: email.split("@")[0] || "عضو فريق", passwordHash: hash, isActivated: true, lastLoginAt: now }).returning();
  } else {
    [merchant] = await db.update(merchants).set({ passwordHash: hash, isActivated: true, updatedAt: now }).where(eq(merchants.id, merchant.id)).returning();
  }
  if (!merchant) return null;
  await lockout.clear(lockId(email));
  await startMerchantSession(merchant, email, null);
  return { merchantId: merchant.id };
}

/** تغيير كلمة المرور لحساب مسجّل الدخول بعد التحقق من القديمة (الإعدادات). */
export async function changeMerchantPassword(merchantId: string, current: string, next: string): Promise<boolean> {
  const [m] = await db.select().from(merchants).where(eq(merchants.id, merchantId)).limit(1);
  if (!m?.passwordHash || !(await verifyPassword(current, m.passwordHash))) return false;
  await db.update(merchants).set({ passwordHash: await hashPassword(next), updatedAt: new Date() }).where(eq(merchants.id, merchantId));
  return true;
}

/** بصمة كلمة المرور الحالية لرابط إعادة التعيين (يبطل بتغييرها). فارغة إن لم تُضبط بعد. */
export const passwordFingerprint = (hash: string | null | undefined) => (hash ? hash.slice(-12) : "");

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
export const getMerchantSession = cache(async (): Promise<MerchantSession> => {
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
});

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
  const session = await getMerchantSession();
  if (!session) redirect("/login");
  // جلسة بلا متجر (حساب لا متجر له): شاشة لطيفة لا /login، لأن /login يعيد من له جلسة إلى اللوحة فتدور الحلقة.
  if (!session.store) redirect("/no-store");
  return session as MerchantStoreSession;
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
