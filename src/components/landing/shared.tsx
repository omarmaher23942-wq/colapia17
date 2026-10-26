// عناصر مشتركة لأقسام الهبوط والصفحتين التعريفيتين: أنماط الأزرار، شارة Eyebrow، عنوان القسم، وأيقونة Google.
import type { ReactNode } from "react";

export const CTA_PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-[#6f86ff] to-[#8fa8ff] px-8 py-4 font-bold text-[#07091a] shadow-[0_0_40px_-8px_rgba(111,134,255,0.75)] transition-transform hover:-translate-y-0.5 active:scale-95 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#07091a]";

export const CTA_GHOST =
  "inline-flex items-center justify-center gap-2 rounded-2xl border border-[#c3cdf0]/25 px-8 py-4 font-semibold text-[#eaf0ff] transition-colors hover:border-[#8fa8ff]/60 hover:bg-white/5 text-sm sm:text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#07091a]";

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[#8fa8ff]/25 bg-[#8fa8ff]/10 px-4 py-1.5 text-xs font-semibold text-[#c3cdf0]">
      {children}
    </span>
  );
}

/** عنوان قسم: h2 افتراضياً، وh1 في الصفحات التعريفية (عنوان رئيسي واحد لكل صفحة). */
export function Heading({ eyebrow, title, subtitle, as: Tag = "h2" }: { eyebrow?: string; title: string; subtitle?: string; as?: "h1" | "h2" }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <Tag className="text-3xl font-black leading-tight sm:text-[2.6rem]">{title}</Tag>
      {subtitle ? <p className="max-w-xl text-[15px] leading-8 text-[#c3cdf0]/75 sm:text-base">{subtitle}</p> : null}
    </div>
  );
}

