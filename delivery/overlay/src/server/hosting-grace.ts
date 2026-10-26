import "server-only";
// hosting-grace.ts (مشروعك الخاص) — لا اشتراك استضافة ولا مهلة سماح. يبقى للواجهة المشتركة (تخطيط المتجر والدفع).
export async function hostingGraceDays(): Promise<number> {
  return 0;
}
