import "server-only";
// merchant-guard.ts — فرض صلاحيات فريق التاجر على الخادم (المرحلة 6). كل صفحة لوحة تبدأ بـ requireStoreArea،
// وكل إجراء يحصل على المتجر بـ storeFor(مجال، مستوى) بدل getMerchantStoreOrNull (يعيد null = «غير مصرح» كما كان).
// صاحب المتجر لا perms في جلسته = كل الصلاحيات.
import { redirect } from "next/navigation";
import { getMerchantStoreOrNull, requireMerchantStore, type MerchantStoreSession } from "@/server/auth";
import { allows, AREA_HREF, firstAllowedArea, OWNER_PERMS, type AccessLevel, type StoreArea, type StorePerms } from "@/lib/store-perms";

export type { StoreArea };

/** صلاحيات الجلسة (بلا perms = صاحب المتجر). */
export function sessionPerms(s: MerchantStoreSession | null): StorePerms {
  if (!s) return OWNER_PERMS;
  const p = (s as { perms?: StorePerms }).perms;
  return p ?? OWNER_PERMS;
}

export const isStoreOwner = (s: MerchantStoreSession) => ((s as { access?: string }).access ?? "owner") === "owner";

/** للإجراءات: جلسة المتجر إن كان العضو يملك المستوى المطلوب في المجال، وإلا null. */
export async function storeFor(area: StoreArea, level: Exclude<AccessLevel, "none"> = "manage"): Promise<MerchantStoreSession | null> {
  const s = await getMerchantStoreOrNull();
  if (!s) return null;
  return allows(sessionPerms(s), area, level) ? s : null;
}

/** للإجراءات الخاصة بصاحب المتجر وحده (الحذف، الاشتراك، النقل، إدارة الفريق إن لم تُمنح). */
export async function ownerStore(): Promise<MerchantStoreSession | null> {
  const s = await getMerchantStoreOrNull();
  return s && isStoreOwner(s) ? s : null;
}

/** للصفحات: بلا صلاحية عرض للمجال ← أول صفحة يملكها العضو (أو تنبيه إن لم يملك شيئاً). */
export async function requireStoreArea(area: StoreArea, level: Exclude<AccessLevel, "none"> = "view"): Promise<MerchantStoreSession> {
  const s = await requireMerchantStore();
  // V2: متجر لم يكتمل إعداده لا تُفتح لوحته: صاحبه يكمل «إعداد المتجر»، والموظف يرى صفحة «قيد الإعداد».
  if (s.store.status === "setup") redirect(isStoreOwner(s) ? "/onboarding" : "/dashboard/setup-pending");
  const perms = sessionPerms(s);
  if (allows(perms, area, level)) return s;
  const first = firstAllowedArea(perms);
  redirect(first && first !== area ? `${AREA_HREF[first]}?denied=${area}` : "/dashboard/no-access");
}

/** صلاحيات عضو الفريق لإخفاء ما لا يخصه في الواجهة (null = صاحب المتجر). */
export function memberPerms(s: object | null | undefined): StorePerms | null {
  return s && (s as { access?: string }).access === "member" ? ((s as { perms?: StorePerms }).perms ?? null) : null;
}
