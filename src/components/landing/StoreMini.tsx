// StoreMini — متجر مصغّر حقيقي الشكل (لا صورة): هيدر وواجهة وعنوان يتكشف وبطاقات منتجات، بهوية متجر كاملة.
// يُستخدم في صفحة الهبوط ليرى الزائر بعينه أن كل متجر يُصمَّم من الصفر: نفس المكوّنات، هوية مختلفة تماماً.
import type { CSSProperties } from "react";
import { Shirt, Watch, Headphones, Gem, Coffee, Baby, Smartphone, Footprints, ShoppingBag, Search } from "lucide-react";

export type MiniStore = {
  name: string;
  concept: string;
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
  products: { name: string; price: string; icon: keyof typeof ICONS }[];
};

const ICONS = { Shirt, Watch, Headphones, Gem, Coffee, Baby, Smartphone, Footprints };

export const MINI_STORES: MiniStore[] = [
  {
    name: "ميادة فاشون",
    concept: "حرير المساء الهادئ",
    bg: "#f6f1ea",
    fg: "#2b2119",
    primary: "#3b2a1e",
    accent: "#b88a5a",
    card: "#fffdf9",
    muted: "#ece3d6",
    font: "var(--font-el-messiri)",
    radius: 4,
    eyebrow: "مجموعة الخريف",
    headline: "فساتين تتفصّل على مقاس لحظتك",
    cta: "اكتشفي المجموعة",
    products: [
      { name: "فستان ساتان", price: "1,250 ج", icon: "Shirt" },
      { name: "عباية كتان", price: "890 ج", icon: "Gem" },
    ],
  },
  {
    name: "تك زون",
    concept: "مختبر الليل",
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
      { name: "سماعة لاسلكية", price: "1,499 ج", icon: "Headphones" },
      { name: "ساعة ذكية", price: "2,150 ج", icon: "Watch" },
    ],
  },
  {
    name: "دنيا البيبي",
    concept: "حلوى الصباح",
    bg: "#fffaf3",
    fg: "#2a1d1d",
    primary: "#e85d5d",
    accent: "#2bb5ab",
    card: "#ffffff",
    muted: "#ffe9e2",
    font: "var(--font-almarai)",
    radius: 22,
    eyebrow: "للأطفال من 0 لـ 6 سنين",
    headline: "ملابس ناعمة على بشرة أولادك",
    cta: "شوفي الجديد",
    products: [
      { name: "طقم قطن", price: "420 ج", icon: "Baby" },
      { name: "حذاء أول خطوة", price: "350 ج", icon: "Footprints" },
    ],
  },
  {
    name: "بيت البن",
    concept: "دفء المحمصة",
    bg: "#1d1410",
    fg: "#f7ead9",
    primary: "#e8a317",
    accent: "#c2410c",
    card: "#291d17",
    muted: "#33251d",
    font: "var(--font-noto-kufi)",
    radius: 0,
    dark: true,
    eyebrow: "محمّص طازة كل أسبوع",
    headline: "قهوتك زي ما تحبها بالظبط",
    cta: "اختار تحميصتك",
    products: [
      { name: "بن تركي محوّج", price: "240 ج", icon: "Coffee" },
      { name: "إسبريسو برازيلي", price: "310 ج", icon: "Coffee" },
    ],
  },
];

export function StoreMini({ s, animate = true, className }: { s: MiniStore; animate?: boolean; className?: string }) {
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
  return (
    <div className={`mini-store flex h-full flex-col overflow-hidden ${animate ? "mini-animate" : ""} ${className ?? ""}`} style={vars} dir="rtl">
      <div className="flex items-center justify-between px-3.5 py-2.5" style={{ borderBottom: `1px solid color-mix(in srgb, ${s.fg} 10%, transparent)` }}>
        <span className="text-[13px] font-black" style={{ color: s.primary }}>
          {s.name}
        </span>
        <span className="flex items-center gap-2 opacity-70">
          <Search className="size-3.5" />
          <ShoppingBag className="size-3.5" />
        </span>
      </div>
      <div className="relative px-3.5 pb-3 pt-4">
        <div aria-hidden="true" className="absolute -top-10 end-0 size-32 rounded-full opacity-40 blur-2xl" style={{ background: s.accent }} />
        <span className="relative text-[9px] font-bold" style={{ color: s.accent }}>
          {s.eyebrow}
        </span>
        <p className="relative mt-1 text-[19px] font-black leading-tight">
          {words.map((w, i) => (
            <span key={i}>
              <span className="mini-w inline-block" style={{ animationDelay: `${i * 90 + 150}ms` }}>
                {w}
              </span>{" "}
            </span>
          ))}
        </p>
        <span
          className="relative mt-3 inline-flex items-center px-3 py-1.5 text-[10px] font-black"
          style={{ background: s.primary, color: s.dark ? s.bg : "#fff", borderRadius: s.radius > 16 ? 999 : s.radius }}
        >
          {s.cta}
        </span>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-2 px-3.5 pb-3.5">
        {s.products.map((p, i) => {
          const Icon = ICONS[p.icon];
          return (
            <div key={p.name} className="mini-card flex flex-col overflow-hidden" style={{ background: s.card, borderRadius: s.radius, animationDelay: `${500 + i * 140}ms`, border: `1px solid color-mix(in srgb, ${s.fg} 8%, transparent)` }}>
              <div className="grid flex-1 place-items-center" style={{ background: `linear-gradient(150deg, ${s.muted}, color-mix(in srgb, ${s.accent} 22%, ${s.muted}))`, minHeight: 64 }}>
                <Icon className="size-7" style={{ color: s.primary }} strokeWidth={1.4} />
              </div>
              <div className="p-2">
                <p className="truncate text-[10px] font-bold">{p.name}</p>
                <p className="text-[10px] font-black" style={{ color: s.primary }}>
                  {p.price}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
