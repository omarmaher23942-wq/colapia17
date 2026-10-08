// E5 — Analytics events لكل تفاعل مهم في onboarding Step 1.
// E22 — data-field attributes موجودة في الحقول (fields.tsx) لدعم heatmaps.
// window.clpTrack اختياري — لا يكسر إذا لم يكن موجوداً.

export type OnboardingEvent =
  | { name: "onboarding_step_1_viewed" }
  | { name: "onboarding_field_completed"; field: string }
  | { name: "onboarding_industry_selected"; industry: string }
  | { name: "onboarding_subdomain_checked"; subdomain: string; status: string }
  | { name: "onboarding_step_1_completed" }
  | { name: "onboarding_shortcut_used"; shortcut: string }
  | { name: "onboarding_voice_used"; field: string }
  | { name: "onboarding_pwa_prompted"; accepted: boolean };

declare global {
  interface Window {
    clpTrack?: (name: string, props?: Record<string, unknown>) => void;
  }
}

export function track(event: OnboardingEvent): void {
  if (typeof window === "undefined") return;
  try {
    const { name, ...props } = event;
    window.clpTrack?.(name, props);
  } catch {
    // نتجاهل أي خطأ — analytics لا يجب أن يكسر الـ UX.
  }
}