// hosting.ts (مشروعك الخاص) — لا استضافة مدفوعة ولا اشتراك: المتجر يعمل ما دام مشروعك منشوراً. هذا الملف يبقي واجهة
// المتجر المشتركة (التخطيط والدفع والخريطة) تعمل كما هي: الحالة دائماً «none» والخدمة دائماً متاحة.
export type HostingState = { phase: "none" };

export function hostingState(_store?: unknown, _now?: Date, _graceDays?: number): HostingState {
  return { phase: "none" };
}

export function hostingServes(_state: HostingState): boolean {
  return true;
}
