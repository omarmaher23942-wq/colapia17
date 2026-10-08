import type { OnboardingSubmission } from "./schema";

/** درجة "ثراء المتجر" 0-100. حتمية بالكامل، تُخزَّن في intakes.completeness وتظهر في Pipeline */
export function richness(s: OnboardingSubmission): number {
  const pList = Array.isArray(s.products) ? s.products : (s.products?.products ?? []);
  const n = Math.max(1, pList.length);
  let score = 0;

  // 1. تقييم المنتجات والأوصاف والصور
  score += Math.min(pList.length, 5) * 6; // 30 نقطة حتى 5 منتجات
  score += Math.round((15 * pList.filter((x) => Boolean(x.description)).length) / n); // 15 نقطة للأوصاف
  score += Math.round((15 * pList.filter((x) => x.images.length > 1).length) / n); // 15 نقطة لتعدد الصور
  if (pList.some((x) => (x.variants?.length ?? 0) > 0)) score += 10; // 10 نقاط للمقاسات والألوان

  // 2. تقييم بيانات المتجر والتواصل
  if (s.store?.logo) score += 10;
  if (s.store?.whatsapp) score += 5;

  // 3. تقييم الشحن والدفع والألوان الموجهة للـ AI
  if (s.launch?.inspectionAllowed) score += 5;
  if (s.launch?.colorPreference) score += 5;
  if (s.launch?.founderStory) score += 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}