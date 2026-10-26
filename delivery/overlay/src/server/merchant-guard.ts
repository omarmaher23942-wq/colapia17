import "server-only";
// merchant-guard.ts (مشروعك الخاص) — حارس صفحات اللوحة وإجراءاتها. صاحب المتجر وحده يدخل مشروعك: كل الصلاحيات.
// الواجهة مطابقة لنسخة المنصة (requireStoreArea / storeFor / ownerStore) فتعمل كل صفحات اللوحة وإجراءاتها كما هي.
// كل صفحة لوحة تبدأ بـ requireStoreArea، وكل إجراء يحصل على المتجر بـ storeFor أو ownerStore (يعيد null = «غير مصرح»).
import { redirect } from "next/navigation";
import { getMerchantStoreOrNull, requireMerchantStore, type MerchantStoreSession } from "@/server/auth";
import { OWNER_PERMS, type AccessLevel, type StoreArea, type StorePerms } from "@/lib/store-perms";

export type { StoreArea };

export function sessionPerms(_s: MerchantStoreSession | null): StorePerms {
  return OWNER_PERMS;
}

export const isStoreOwner = (_s: MerchantStoreSession) => true;

/** لا قفل للوحة في مشروعك. */
export async function storeLock(_store: MerchantStoreSession["store"]): Promise<null> {
  return null;
}

export async function storeFor(_area: StoreArea, _level: Exclude<AccessLevel, "none"> = "manage"): Promise<MerchantStoreSession | null> {
  return getMerchantStoreOrNull();
}

export async function ownerStore(_opts: { allowLocked?: boolean } = {}): Promise<MerchantStoreSession | null> {
  return getMerchantStoreOrNull();
}

/** للصفحات: بلا جلسة ← الدخول؛ المتجر قيد الإعداد ← «إعداد المتجر». */
export async function requireStoreArea(_area: StoreArea, _level: Exclude<AccessLevel, "none"> = "view"): Promise<MerchantStoreSession> {
  const s = await requireMerchantStore();
  if (s.store.status === "setup") redirect("/onboarding");
  return s;
}

/** صلاحيات عضو الفريق (لا أعضاء في مشروعك: null = صاحب المتجر). */
export function memberPerms(_s: object | null | undefined): StorePerms | null {
  return null;
}
