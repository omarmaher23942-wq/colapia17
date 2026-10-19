// store-visibility.ts — قاعدة رؤية المتجر الواحدة (V2-PLAN 3.1). منطق خالص مختبَر بلا تبعيات خادم.
// يستخدمها تخطيط المتجر وصفحاته، والدفع وواجهات المتجر العامة، وrobots وsitemap وبيانات SEO.
//
//  - setup: أنشأه الوكيل والإعداد لم يكتمل ← مخفي تماماً، وصفحة محايدة «قيد الإعداد» بلا اسم المتجر.
//  - trial: ظاهر للزوار ويستقبل الطلبات، ولا يُفهرس.
//  - active: ظاهر ويُفهرس، ما دامت استضافته تخدمه (لا paused ولا offline).
//  - frozen: انتهت التجربة بلا دفع ← بوابة «غير متاح حالياً».
//  - الحالات القديمة (intake/pending_review/building/review) تُعامل كـ setup: لا كود جديد يكتبها.
//  - suspended/deleted ← «unavailable» (والتخطيط يرد 404 لها أصلاً).

export type VisibilityGate = "setup" | "frozen" | "paused" | "offline" | "unavailable";

export type StoreVisibility = {
  /** يرى الزوار المتجر ويستطيعون الطلب منه */
  public: boolean;
  /** البوابة المعروضة بدل المتجر، أو null إن كان ظاهراً */
  gate: VisibilityGate | null;
  /** يُسمح لمحركات البحث بفهرسته */
  indexable: boolean;
};

export type VisibilityStore = { status: string; deletedAt?: Date | null };
/** يكفي طور الاستضافة من lib/hosting.ts (hostingState). */
export type VisibilityHosting = { phase: string };

const LEGACY_SETUP: ReadonlySet<string> = new Set(["setup", "intake", "pending_review", "building", "review"]);

const hidden = (gate: VisibilityGate): StoreVisibility => ({ public: false, gate, indexable: false });

export function storeVisibility(store: VisibilityStore, hosting: VisibilityHosting): StoreVisibility {
  if (store.deletedAt) return hidden("unavailable");
  if (LEGACY_SETUP.has(store.status)) return hidden("setup");
  switch (store.status) {
    case "trial":
      return { public: true, gate: null, indexable: false };
    case "frozen":
      return hidden("frozen");
    case "active":
      if (hosting.phase === "paused") return hidden("paused");
      if (hosting.phase === "offline") return hidden("offline");
      return { public: true, gate: null, indexable: true };
    default:
      return hidden("unavailable");
  }
}

/** هل البوابة تكشف اسم المتجر؟ متجر قيد الإعداد لا يكشف شيئاً عن نفسه. */
export function gateShowsName(gate: VisibilityGate | null): boolean {
  return gate !== "setup" && gate !== "unavailable";
}

/**
 * قفل لوحة التاجر (V3-PLAN 1، D4): متجر مجمّد بعد انتهاء التجربة بلا دفع، أو متوقف بعد انتهاء اشتراكه ومهلة السماح،
 * تُقفل لوحته كلها إلا صفحة الاشتراك (والاستخدام والخروج)، ثم يعود كل شيء كما كان فور قبول الدفع.
 * التجربة الجارية والإيصال قيد المراجعة لا يقفلان شيئاً (التجميد نفسه يتأجل أثناء المراجعة في دورة الحياة).
 */
export type DashboardLock = "frozen" | "paused" | null;

export function dashboardLock(store: VisibilityStore, hosting: VisibilityHosting): DashboardLock {
  if (store.deletedAt) return null;
  if (store.status === "frozen") return "frozen";
  if (store.status === "active" && hosting.phase === "paused") return "paused";
  return null;
}

/** الصفحات المفتوحة أثناء القفل. */
export const LOCK_OPEN_PATHS = ["/dashboard/billing", "/dashboard/usage"] as const;

export function lockAllowsPath(path: string): boolean {
  const p = path.split(/[?#]/)[0] ?? "";
  return LOCK_OPEN_PATHS.some((x) => p === x || p.startsWith(`${x}/`));
}
