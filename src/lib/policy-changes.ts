// policy-changes.ts — منطق خالص لحفظ «السياسات والضمان»: يطبّع مسودة التاجر ويحسب التغييرات الجزئية فقط
// (الدمج بنمط diff/patch) بدل كتابة نسخة كاملة فوق ما حُفظ من صفحات أخرى. الخادم يسمح بمسارات هذه الصفحة وحدها.
import type { StoreBlueprint } from "@/blueprint/schema";
import { diffBlueprint, type BpChange } from "@/lib/blueprint-patch";

export type PolicyDraft = { returns: StoreBlueprint["returns"]; shipping: StoreBlueprint["shipping"] };
type Base = Pick<StoreBlueprint, "returns" | "shipping" | "conversion">;

export const GIFT_FEE_MAX_POUNDS = 1000;
/** المسارات التي يحق لهذه الصفحة تعديلها (القائمة البيضاء على الخادم). */
export const POLICY_PATHS: Record<string, readonly string[] | "*"> = {
  returns: "*",
  shipping: ["inspectionAllowed", "freeOverPiasters", "generalEta", "pickupEnabled", "pickupAddress", "giftEnabled", "giftWrapPiasters"],
  conversion: ["freeShippingBar"],
};

export const poundsToPiasters = (pounds: number): number => Math.round(Math.max(0, Math.min(GIFT_FEE_MAX_POUNDS, Number.isFinite(pounds) ? pounds : 0)) * 100);

/** ما يُحفظ فعلاً بعد التطبيع: مدة «لا يوجد» تعطّل الاستبدال والاسترجاع، وعنوان الاستلام وسعر التغليف لا يبقيان بعد تعطيل خيارهما. */
export function normalizePolicies(base: Base, d: PolicyDraft): Base {
  const returns = d.returns.windowDays === 0 ? { ...d.returns, allowExchange: false, allowRefund: false } : d.returns;
  const giftOn = d.shipping.giftEnabled === true;
  const shipping: StoreBlueprint["shipping"] = {
    ...base.shipping,
    inspectionAllowed: d.shipping.inspectionAllowed,
    freeOverPiasters: d.shipping.freeOverPiasters,
    generalEta: d.shipping.generalEta,
    pickupEnabled: d.shipping.pickupEnabled,
    pickupAddress: d.shipping.pickupEnabled ? d.shipping.pickupAddress : undefined,
    // «لم يُضبط» (undefined) يبقى كما هو إن لم يلمسه التاجر، وإلا true/false صريحة.
    giftEnabled: giftOn ? true : d.shipping.giftEnabled === undefined ? undefined : false,
    giftWrapPiasters: giftOn ? (d.shipping.giftWrapPiasters ?? 0) : undefined,
  };
  const bar = base.conversion.freeShippingBar;
  const conversion = { ...base.conversion, freeShippingBar: { ...bar, enabled: Boolean(shipping.freeOverPiasters), thresholdPiasters: shipping.freeOverPiasters ?? bar.thresholdPiasters } };
  return { returns, shipping, conversion };
}

/** رسالة الخطأ الأولى للتاجر، أو null إن كانت المسودة صالحة. */
export function policyIssue(d: PolicyDraft): string | null {
  if (d.shipping.generalEta.trim().length < 3) return "اكتبوا مدة التوصيل كما تظهر للعميل";
  if (d.shipping.pickupEnabled && !d.shipping.pickupAddress?.trim()) return "اكتبوا عنوان الاستلام من المتجر";
  if (d.returns.windowDays > 0 && !d.returns.allowExchange && !d.returns.allowRefund) return "اختاروا الاستبدال أو الاسترجاع أو كليهما، أو اجعلوا المدة «لا يوجد»";
  const fee = d.shipping.giftWrapPiasters;
  if (d.shipping.giftEnabled && fee !== undefined && (!Number.isInteger(fee) || fee < 0 || fee > GIFT_FEE_MAX_POUNDS * 100)) return `رسوم التغليف بين 0 و${GIFT_FEE_MAX_POUNDS} جنيه`;
  return null;
}

/** التغييرات الجزئية من نسخة الفتح إلى المسودة المطبّعة. */
export function policyChanges(base: Base, d: PolicyDraft): BpChange[] {
  const next = normalizePolicies(base, d);
  return diffBlueprint({ returns: base.returns, shipping: base.shipping, conversion: base.conversion }, next);
}

/** هل كل تغيير ضمن مسارات هذه الصفحة؟ (الخادم يرفض غير ذلك) */
export function changesAllowed(changes: readonly BpChange[]): boolean {
  return changes.every(({ path }) => {
    const rule = POLICY_PATHS[path[0]];
    if (!rule) return false;
    if (rule === "*") return true;
    return path.length === 2 && rule.includes(path[1]!);
  });
}
