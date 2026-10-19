// ThemesShowcase — التصميمات الثمانية الكاملة بألوانها الحقيقية من THEMES، مع صور من المتجر التجريبي (مستضافة محلياً).
// خادم بالكامل: لا JS للعميل. الألوان مضمّنة (inline) فلا يغيّرها وضع الهبوط الفاتح.
import Image from "next/image";
import { THEMES } from "@/blueprint/themes";

/** لون نص مقروء فوق الخلفية (سطوع نسبي بسيط). */
function readableOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#ffffff";
  const n = parseInt(m[1]!, 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? "#0b1020" : "#ffffff";
}

const SHOTS = [
  { src: "/demo/editorial/lookbook-1.webp", alt: "صورة منتج من المتجر التجريبي", w: 1000, h: 1250 },
  { src: "/demo/editorial/lookbook-2.webp", alt: "صورة منتج من المتجر التجريبي", w: 1000, h: 1250 },
  { src: "/demo/editorial/hero-side.webp", alt: "واجهة المتجر التجريبي", w: 1000, h: 1250 },
  { src: "/demo/editorial/lookbook-3.webp", alt: "صورة منتج من المتجر التجريبي", w: 1000, h: 1250 },
] as const;

export function ThemesShowcase() {
  return (
    <>
      <ul className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4" aria-label="التصميمات الثمانية">
        {THEMES.map((t) => {
          const [bg, accent, primary] = t.swatch;
          const fg = readableOn(bg);
          return (
            <li key={t.id} className="overflow-hidden rounded-3xl border border-white/10 shadow-lg" style={{ backgroundColor: bg, color: fg }}>
              <div className="flex flex-col gap-3 p-4 sm:p-5">
                <span className="flex items-center gap-1.5" aria-hidden="true">
                  <span className="size-6 rounded-full ring-2 ring-white/20" style={{ backgroundColor: primary }} />
                  <span className="size-6 rounded-full ring-2 ring-white/20" style={{ backgroundColor: accent }} />
                  <span className="h-1.5 flex-1 rounded-full opacity-60" style={{ backgroundColor: fg }} />
                </span>
                <div>
                  <p className="text-[15px] font-black">{t.name}</p>
                  <p className="mt-1 text-[12.5px] leading-6 opacity-80">{t.tagline}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {SHOTS.map((s, i) => (
          <div key={s.src} className={`overflow-hidden rounded-3xl border border-white/10 shadow-xl ${i % 2 ? "sm:translate-y-6" : ""}`}>
            <Image src={s.src} alt={s.alt} width={s.w} height={s.h} sizes="(min-width: 640px) 25vw, 50vw" loading="lazy" className="h-auto w-full" />
          </div>
        ))}
      </div>
    </>
  );
}
