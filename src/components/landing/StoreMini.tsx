// StoreMini — متجر مصغّر بصور منتجات حقيقية: هيدر وواجهة وعنوان وبطاقات منتجات بهوية متجر كاملة.
// يُستخدم في الهبوط ليرى الزائر أن كل متجر يُصمَّم لنشاطه: نفس الجودة، هوية مختلفة. أسماء المتاجر هنا أمثلة توضيحية.
import type { CSSProperties } from "react";
import Image from "next/image";
import { ShoppingBag, Search } from "lucide-react";

export type MiniStore = {
  name: string;
  /** وصف قصير للنشاط (يظهر تحت المتجر في المعرض). */
  kind: string;
  bg: string;
  fg: string;
  primary: string;
  accent: string;
  card: string;
  muted: string;
  font: string;
  radius: number;
  dark?: boolean;
  eyebrow: string;
  headline: string;
  cta: string;
  /** صورة واجهة اختيارية؛ بدونها تظهر واجهة بتدرج هوية المتجر. */
  hero?: string;
  products: { name: string; price: string; img: string }[];
};

export const MINI_STORES: MiniStore[] = [
  {
    name: "ميادة",
    kind: "أزياء نسائية",
    bg: "#f6f1ea",
    fg: "#2b2119",
    primary: "#3b2a1e",
    accent: "#b88a5a",
    card: "#fffdf9",
    muted: "#ece3d6",
    font: "var(--font-el-messiri)",
    radius: 4,
    eyebrow: "مجموعة الخريف",
    headline: "تفاصيل هادئة. حضور واضح.",
    cta: "تسوّق المجموعة",
    hero: "/landing/fashion-rack.webp",
    products: [
      { name: "بلوزة كروشيه", price: "690 ج", img: "/landing/fashion-a.webp" },
      { name: "حقيبة يد جلد", price: "1,450 ج", img: "/landing/bag.webp" },
    ],
  },
  {
    name: "تك زون",
    kind: "إلكترونيات وإكسسوارات",
    bg: "#0b0f17",
    fg: "#e8f4ff",
    primary: "#3dd6ff",
    accent: "#a3ff5c",
    card: "#121a26",
    muted: "#1a2433",
    font: "var(--font-readex-pro)",
    radius: 12,
    dark: true,
    eyebrow: "وصل حديثاً",
    headline: "صوت أنقى. شحن أسرع.",
    cta: "تسوّق الآن",
    products: [
      { name: "سماعة لاسلكية", price: "1,499 ج", img: "/landing/tech-a.webp" },
      { name: "ساعة ذكية", price: "2,150 ج", img: "/landing/tech-b.webp" },
    ],
  },
  {
    name: "ستريت كيكس",
    kind: "أحذية رياضية",
    bg: "#f4f4f2",
    fg: "#141414",
    primary: "#e11d2e",
    accent: "#111111",
    card: "#ffffff",
    muted: "#e9e9e6",
    font: "var(--font-almarai)",
    radius: 14,
    eyebrow: "إصدار محدود",
    headline: "خطوة تسبق الباقي.",
    cta: "اكتشف الجديد",
    products: [
      { name: "كوتشي رانينج", price: "1,350 ج", img: "/landing/shoes-a.webp" },
      { name: "كوتشي كاجوال", price: "1,100 ج", img: "/landing/shoes-b.webp" },
    ],
  },
  {
    name: "بيت البن",
    kind: "قهوة مختصة",
    bg: "#1d1410",
    fg: "#f7ead9",
    primary: "#e8a317",
    accent: "#c2410c",
    card: "#291d17",
    muted: "#33251d",
    font: "var(--font-noto-kufi)",
    radius: 0,
    dark: true,
    eyebrow: "محمّص طازج أسبوعياً",
    headline: "قهوتك على مزاجك.",
    cta: "اختر التحميصة",
    hero: "/landing/coffee-b.webp",
    products: [
      { name: "بن تركي محوّج", price: "240 ج", img: "/landing/coffee-beans.webp" },
      { name: "بن برازيلي", price: "310 ج", img: "/landing/coffee-a.webp" },
    ],
  },
];

export function StoreMini({ s, animate = true, className, priority = false }: { s: MiniStore; animate?: boolean; className?: string; priority?: boolean }) {
  const vars = {
    "--m-bg": s.bg,
    "--m-fg": s.fg,
    "--m-primary": s.primary,
    "--m-accent": s.accent,
    "--m-card": s.card,
    "--m-muted": s.muted,
    "--m-r": `${s.radius}px`,
    fontFamily: `${s.font}, system-ui, sans-serif`,
    background: s.bg,
    color: s.fg,
  } as CSSProperties;
  const words = s.headline.split(" ");
  const onHero = Boolean(s.hero);
  const btnRadius = s.radius > 16 ? 999 : s.radius;
  return (
    <div aria-hidden="true" className={`mini-store flex h-full flex-col overflow-hidden ${animate ? "mini-animate" : ""} ${className ?? ""}`} style={vars} dir="rtl">
      <div className="flex items-center justify-between px-3.5 py-2.5" style={{ borderBottom: `1px solid color-mix(in srgb, ${s.fg} 10%, transparent)` }}>
        <span className="text-[13px] font-black" style={{ color: s.primary === "#e11d2e" ? s.fg : s.primary }}>
          {s.name}
        </span>
        <span className="flex items-center gap-2 opacity-70">
          <Search className="size-3.5" />
          <ShoppingBag className="size-3.5" />
        </span>
      </div>

      <div className="relative mx-3 mt-3 overflow-hidden" style={{ borderRadius: Math.min(s.radius, 18), minHeight: 118, background: `linear-gradient(135deg, ${s.muted}, color-mix(in srgb, ${s.accent} 30%, ${s.muted}))` }}>
        {onHero ? <Image src={s.hero!} alt="" fill sizes="320px" priority={priority} className="object-cover" /> : null}
        {onHero ? <div className="absolute inset-0" style={{ background: "linear-gradient(to left, rgb(0 0 0 / .55), rgb(0 0 0 / .05) 70%)" }} /> : null}
        <div className="relative flex h-full flex-col justify-end gap-1.5 p-3" style={{ color: onHero ? "#fff" : s.fg }}>
          <span className="text-[9px] font-bold" style={{ color: onHero ? "#fff" : s.primary, opacity: onHero ? 0.85 : 1 }}>
            {s.eyebrow}
          </span>
          <p className="text-[17px] font-black leading-tight">
            {words.map((w, i) => (
              <span key={i}>
                <span className="mini-w inline-block" style={{ animationDelay: `${i * 90 + 150}ms` }}>
                  {w}
                </span>{" "}
              </span>
            ))}
          </p>
          <span className="mt-0.5 inline-flex w-fit items-center px-3 py-1.5 text-[10px] font-black" style={{ background: s.primary, color: s.dark || s.primary === "#e11d2e" ? (s.dark ? s.bg : "#fff") : "#fff", borderRadius: btnRadius }}>
            {s.cta}
          </span>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-2 gap-2 px-3 pb-3 pt-3">
        {s.products.map((p, i) => (
          <div key={p.name} className="mini-card flex flex-col overflow-hidden" style={{ background: s.card, borderRadius: s.radius, animationDelay: `${500 + i * 140}ms`, border: `1px solid color-mix(in srgb, ${s.fg} 8%, transparent)` }}>
            <div className="relative flex-1" style={{ minHeight: 84, background: s.muted }}>
              <Image src={p.img} alt="" fill sizes="160px" className="object-cover" />
            </div>
            <div className="p-2">
              <p className="truncate text-[10px] font-bold">{p.name}</p>
              <p className="text-[10px] font-black" style={{ color: s.primary === "#e11d2e" ? s.primary : s.primary }}>
                {p.price}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
