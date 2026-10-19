// store-quality.ts — فحص جودة المتجر قبل النشر (خالص ومختبَر): اقتراحات صادقة وغير مانعة بناءً على ما أدخله التاجر فعلاً.
// لا يختلق محتوى ولا آراء ولا أرقاماً؛ ما تركه التاجر فارغاً يبقى فارغاً ونخبره بما يحسّن متجره ومكان إضافته.
import type { StepId } from "@/lib/onboarding";

export type QualityFacts = {
  hasLogo: boolean;
  activeProducts: number;
  withoutImage: number;
  withoutDescription: number;
  categories: number;
  /** نشاط يستعمل المقاسات (ملابس، أحذية، أطفال) */
  usesSizes: boolean;
  sizeGuideCharts: number;
};

export type QualityTip = { id: string; text: string; step?: StepId };

/** حتى 4 اقتراحات مرتبة بالأهم أولاً. */
export function qualityTips(f: QualityFacts): QualityTip[] {
  const tips: QualityTip[] = [];
  if (f.withoutImage > 0) tips.push({ id: "images", step: "products", text: `${f.withoutImage} منتج بلا صورة. المنتج بصورة أوضح للزبون وأسهل في الشراء؛ اضغطوا على صورته البديلة في «المنتجات» لتصوير صورة أو اختيارها.` });
  if (f.activeProducts > 0 && f.activeProducts < 6) tips.push({ id: "count", step: "products", text: "منتجاتكم قليلة حالياً. ابدؤوا بما لديكم، وأضيفوا الباقي في أي وقت بالصور المجمّعة." });
  if (f.withoutDescription > 0) tips.push({ id: "desc", text: `${f.withoutDescription} منتج بلا وصف. جملة قصيرة عن الخامة أو الاستخدام تساعد الزبون على القرار.` });
  if (!f.hasLogo) tips.push({ id: "logo", step: "identity", text: "لم تضيفوا شعاراً، فنعرض اسم المتجر نصاً. يمكنكم رفع الشعار في أي وقت." });
  if (f.usesSizes && f.sizeGuideCharts === 0) tips.push({ id: "size", text: "منتجاتكم بمقاسات. دليل المقاسات (من لوحة التحكم ← دليل المقاسات) يقلل الاستبدال." });
  if (f.categories > 8) tips.push({ id: "cats", text: "أقسامكم كثيرة. دمج المتشابه منها يسهّل التصفح على الزبون." });
  return tips.slice(0, 4);
}
