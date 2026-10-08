// عناصر مشتركة لكل أقسام صفحة الهبوط: تنسيقات الأزرار، عناوين الأقسام،
// شارة Eyebrow، أيقونة Google، ودالة تنسيق الأرقام بالجنيه المصري.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function fmtEGP(n: number) {
  return new Intl.NumberFormat("ar-EG").format(n);
}

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

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: "center" | "start";
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" ? "items-center text-center" : "items-start text-start",
      )}
    >
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="h2-responsive max-w-2xl font-black text-[#eaf0ff]">{title}</h2>
      {subtitle && (
        <p className="max-w-xl text-base leading-relaxed text-[#c3cdf0]/75 sm:text-lg">{subtitle}</p>
      )}
    </div>
  );
}

export function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6C29.6 35 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.6 5.1C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4 5.7l6.6 5.6c-.5.4 7.1-5.2 7.1-15.3 0-1.3-.1-2.7-.4-3.5z"
      />
    </svg>
  );
}