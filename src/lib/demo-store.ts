// demo-store.ts — متجر العرض (demo.colapia.com): علامته stores.prefs.demo = true يضعها سكربت الزرع (scripts/demo/seed-demo.ts).
// كل طلب فيه تجريبي (orders.is_test): لا يخصم مخزوناً ولا يُحسب في المبيعات والعدادات، ولا يُرسل عنه بريد ولا حدث بكسل،
// ولا تُحفظ سلاته المتروكة. وتقول صفحتا الدفع والطلب للزائر إنه متجر عرض لا يشحن ولا يطلب دفعاً.
// خالص بلا تبعيات: يستخدمه الخادم والمتصفح والاختبارات.

export const DEMO_PREF_KEY = "demo";

/** هل المتجر متجر العرض؟ القيمة المنطقية true وحدها (لا نص ولا رقم). */
export function isDemoStore(store: { prefs?: unknown } | null | undefined): boolean {
  const p = store?.prefs;
  return Boolean(p && typeof p === "object" && !Array.isArray(p) && (p as Record<string, unknown>)[DEMO_PREF_KEY] === true);
}

/** هل الطلب تجريبي؟ معاينة الفريق، أو صاحب المتجر وفريقه يطلبون من متجرهم، أو أي طلب في متجر العرض. */
export function isTestOrder(ctx: { teamPreview: boolean; ownStore: boolean; demoStore: boolean }): boolean {
  return ctx.teamPreview || ctx.ownStore || ctx.demoStore;
}
