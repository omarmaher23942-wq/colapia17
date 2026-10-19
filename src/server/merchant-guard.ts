import "server-only";
// merchant-guard.ts — فرض صلاحيات فريق التاجر على الخادم (المرحلة 6). كل صفحة لوحة تبدأ بـ requireStoreArea،
// وكل إجراء يحصل على المتجر بـ storeFor(مجال، مستوى) بدل getMerchantStoreOrNull (يعيد null = «غير مصرح» كما كان).
// صاحب المتجر لا perms في جلسته = كل الصلاحيات.
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getMerchantStoreOrNull, requireMerchantStore, type MerchantStoreSession } from "@/server/auth";
import { allows, AREA_HREF, firstAllowedArea, OWNER_PERMS, type AccessLevel, type StoreArea, type StorePerms } from "@/lib/store-perms";
import { hostingState } from "@/lib/hosting";
import { dashboardLock, lockAllowsPath, type DashboardLock } from "@/lib/store-visibility";
import { hostingGraceDays } from "@/server/hosting-grace";

export type { StoreArea };

/** صلاحيات الجلسة (بلا perms = صاحب المتجر). */
export function sessionPerms(s: MerchantStoreSession | null): StorePerms {
  if (!s) return OWNER_PERMS;
  const p = (s as { perms?: StorePerms }).perms;
  return p ?? OWNER_PERMS;
}

export const isStoreOwner = (s: MerchantStoreSession) => ((s as { access?: string }).access ?? "owner") === "owner";

/**
 * قفل اللوحة (V3، D4): مجمّد بعد التجربة أو متوقف بعد انتهاء الاشتراك والسماح ← اللوحة مقفلة إلا الاشتراك.
 * منطقه الخالص في lib/store-visibility.ts (dashboardLock).
 */
export async function storeLock(store: MerchantStoreSession["store"]): Promise<DashboardLock> {
  if (store.status !== "frozen" && store.status !== "active") return null;
  const grace = await hostingGraceDays().catch(() => undefined);
  return dashboardLock(store, hostingState(store, new Date(), grace));
}

/** للإجراءات: جلسة المتجر إن كان العضو يملك المستوى المطلوب في المجال، وإلا null. المتجر المقفل لا يُقرأ ولا يُعدَّل إلا اشتراكه. */
export async function storeFor(area: StoreArea, level: Exclude<AccessLevel, "none"> = "manage"): Promise<MerchantStoreSession | null> {
  const s = await getMerchantStoreOrNull();
  if (!s) return null;
  if (!allows(sessionPerms(s), area, level)) return null;
  // المتجر المقفل (مجمّد/متوقف) لا يُقرأ ولا يُعدَّل من اللوحة (ومنها التصدير) إلا الاشتراك.
  if (area !== "billing" && (await storeLock(s.store))) return null;
  return s;
}

/** للإجراءات الخاصة بصاحب المتجر وحده (الحذف، الاشتراك، النقل، إدارة الفريق إن لم تُمنح). */
export async function ownerStore(opts: { allowLocked?: boolean } = {}): Promise<MerchantStoreSession | null> {
  const s = await getMerchantStoreOrNull();
  if (!s || !isStoreOwner(s)) return null;
  // القفل يسري على صاحب المتجر أيضاً (النطاق، الرابط، الإعداد…)؛ الاشتراك والحساب وحدهما يمرّان بـ allowLocked.
  if (!opts.allowLocked && (await storeLock(s.store))) return null;
  return s;
}

/** للصفحات: بلا صلاحية عرض للمجال ← أول صفحة يملكها العضو (أو تنبيه إن لم يملك شيئاً). */
export async function requireStoreArea(area: StoreArea, level: Exclude<AccessLevel, "none"> = "view"): Promise<MerchantStoreSession> {
  const s = await requireMerchantStore();
  // V2: متجر لم يكتمل إعداده لا تُفتح لوحته: صاحبه يكمل «إعداد المتجر»، والموظف يرى صفحة «قيد الإعداد».
  if (s.store.status === "setup") redirect(isStoreOwner(s) ? "/onboarding" : "/dashboard/setup-pending");
  // V3: المتجر المجمّد أو المتوقف تُقفل لوحته كلها إلا صفحة الاشتراك، ويعود كل شيء كما كان فور قبول الدفع.
  if (await storeLock(s.store)) {
    // الاشتراك لصاحب المتجر (أو من يملك مجال الاشتراك)؛ غيره يرى «مقفلة مؤقتاً» بدل حلقة تحويل.
    if (!allows(sessionPerms(s), "billing", "view")) redirect("/dashboard/no-access?locked=1");
    const path = (await headers()).get("x-pathname") ?? "";
    if (path ? !lockAllowsPath(path) : area !== "billing") redirect("/dashboard/billing?locked=1");
  }
  const perms = sessionPerms(s);
  if (allows(perms, area, level)) return s;
  const first = firstAllowedArea(perms);
  redirect(first && first !== area ? `${AREA_HREF[first]}?denied=${area}` : "/dashboard/no-access");
}

/** صلاحيات عضو الفريق لإخفاء ما لا يخصه في الواجهة (null = صاحب المتجر). */
export function memberPerms(s: object | null | undefined): StorePerms | null {
  return s && (s as { access?: string }).access === "member" ? ((s as { perms?: StorePerms }).perms ?? null) : null;
}
