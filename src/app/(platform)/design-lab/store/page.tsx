// معمل التصميم: الصفحة الرئيسية بأنظمة تصميم مختلفة وأعداد منتجات مختلفة، بلا قاعدة بيانات (تطوير فقط).
//   ?d=0..3 نظام التصميم   ?n=1..12 عدد المنتجات   ?m=calm|lively|cinematic الحركة   ?h=orbit|... الواجهة
import { notFound } from "next/navigation";
import { defaultBlueprint } from "@/blueprint/defaults";
import { designSchema, blueprintSchema, type StoreBlueprint } from "@/blueprint/schema";
import { themeStyleSheet } from "@/blueprint/theme";
import { designStyleSheet } from "@/blueprint/design";
import { buildFullPalette } from "@/blueprint/palette";
import { storeFacts } from "@/blueprint/facts";
import { Hero } from "@/components/blocks/Hero";
import { TrustBadges } from "@/components/blocks/TrustBadges";
import { BrandStory } from "@/components/blocks/BrandStory";
import { Faq } from "@/components/blocks/Faq";
import { StoreLab } from "./StoreLab";
import { DepthController } from "@/components/storefront/DepthController";

export const dynamic = "force-dynamic";

const PRESETS = [
  {
    name: "مياده فاشون",
    dark: false,
    palette: buildFullPalette("#f6f1ea", "#3b2a1e", "#b88a5a"),
    fonts: { heading: "el_messiri", body: "tajawal" },
    card: "editorial",
    hero: "editorial",
    design: { layout: { density: "airy", headingAlign: "center" }, type: { headingWeight: 600, headingScale: 1.15 }, shape: { card: 4, button: 2, image: 2 }, surface: { background: "paper", rhythm: "alternate", divider: "line" }, elevation: { level: 0, border: 1 }, card: { ratio: "tall", hover: "swap", priceStyle: "underline", badge: "tag", quickAdd: "none" }, button: { fill: "solid", size: "lg" }, icon: { frame: "outline", stroke: 1.25 }, heading: { style: "ornament" } },
    css: ".s-eyebrow{letter-spacing:.12em} .s-btn{letter-spacing:.04em}",
  },
  {
    name: "دنيا البيبي",
    dark: false,
    palette: buildFullPalette("#fffaf3", "#e85d5d", "#2bb5ab"),
    fonts: { heading: "almarai", body: "almarai" },
    card: "floating",
    hero: "collage",
    design: { layout: { density: "balanced" }, type: { headingWeight: 800 }, shape: { card: 28, button: 999, image: 22, chip: 999 }, surface: { background: "dots", rhythm: "bands", divider: "curve" }, elevation: { level: 2, border: 0, tint: "#e85d5d" }, card: { ratio: "square", fit: "contain", imagePad: 14, imageBg: "tint", hover: "lift", priceStyle: "pill", badge: "pill", align: "center", quickAdd: "button" }, button: { fill: "gradient" }, icon: { frame: "circle", tone: "accent" }, heading: { style: "underline" } },
    css: ".s-card:hover{transform:translateY(-6px) rotate(-.4deg)}",
  },
  {
    name: "تك زون",
    dark: true,
    palette: buildFullPalette("#0b0f17", "#3dd6ff", "#a3ff5c"),
    fonts: { heading: "readex_pro", body: "ibm_plex_arabic" },
    card: "glass",
    hero: "split",
    design: { layout: { container: "wide", density: "compact" }, type: { headingWeight: 700, headingTracking: -0.03 }, shape: { card: 12, button: 10, image: 10 }, surface: { background: "grid", rhythm: "alternate", divider: "none", grain: true }, elevation: { level: 3, border: 1, tint: "#000000" }, card: { ratio: "square", fit: "contain", imagePad: 18, imageBg: "gradient", hover: "glow", priceStyle: "accent", badge: "corner" }, button: { fill: "glass" }, icon: { frame: "square", tone: "primary" }, heading: { style: "split" } },
    css: ".s-price{text-shadow:0 0 18px color-mix(in srgb,var(--primary) 60%,transparent)}",
  },
  {
    name: "بيت العسل",
    dark: false,
    palette: buildFullPalette("#fff7e8", "#a3460a", "#e8a317"),
    fonts: { heading: "noto_kufi", body: "cairo" },
    card: "brutalist",
    hero: "centered",
    design: { layout: { density: "balanced" }, type: { headingWeight: 900 }, shape: { card: 0, button: 0, image: 0 }, surface: { background: "radial_glow", rhythm: "bands", divider: "slant" }, elevation: { level: 0, border: 2 }, card: { ratio: "portrait", hover: "none", priceStyle: "bold", badge: "ribbon" }, button: { fill: "outline", weight: 900 }, icon: { frame: "none" }, heading: { style: "eyebrow" } },
    css: "",
  },
] as const;

const img = (seed: string) => `https://picsum.photos/seed/${seed}/800/1000`;

export default async function StoreLabPage({ searchParams }: { searchParams: Promise<{ d?: string; n?: string; m?: string; h?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const sp = await searchParams;
  const di = Math.max(0, Math.min(PRESETS.length - 1, Number(sp.d) || 0));
  const preset = PRESETS[di]!;
  const n = Math.max(1, Math.min(12, Number(sp.n) || 6));
  const base = defaultBlueprint({ name: preset.name } as never);
  const bp: StoreBlueprint = blueprintSchema.parse({
    ...base,
    brand: { ...base.brand, name: preset.name },
    theme: { ...base.theme, palette: preset.palette, mode: preset.dark ? "dark" : "light", fonts: { ...preset.fonts, baseSize: 16 }, productCardStyle: preset.card },
    design: designSchema.parse({ ...preset.design, motion: { level: ["calm", "lively", "cinematic"].includes(sp.m ?? "") ? sp.m : "cinematic", depth: true } }),
    customCss: preset.css,
    returns: { ...base.returns, windowDays: 0, allowExchange: false, allowRefund: false, defectPolicy: "replace" },
    shipping: { ...base.shipping, inspectionAllowed: false, freeOverPiasters: 150000 },
  });
  const facts = storeFacts(bp, { activeGovernorates: 27, fastestDays: 3 });
  const hero = {
    id: "h",
    type: "hero",
    enabled: true,
    spacing: "spacious",
    background: "default",
    reveal: "none",
    variant: sp.h || preset.hero,
    eyebrow: "مجموعة الخريف",
    headline: preset.dark ? "إكسسوارات موبايلك بأداء يستاهل" : "فساتين سهرة تتفصّل على مقاس لحظتك",
    subheadline: "قطع مختارة بإيد صاحبة المتجر، بخامات تحس بفرقها من أول لمسة، وتوصل لحد باب بيتك.",
    images: [1, 2, 3, 4, 5, 6].map((i) => ({ url: img(`lab${di}${i}`), alt: "", focalX: 0.5, focalY: 0.4 })),
    primaryCta: { label: "اكتشفي المجموعة", target: { type: "all_products" }, style: "primary" },
    secondaryCta: { label: "شوفي الأقسام", target: { type: "all_products" }, style: "secondary" },
    highlights: [],
    overlayOpacity: 0.4,
    textAlign: "start",
    height: "tall",
    autoplayMs: 5000,
    enableParallax: true,
    enableKineticTypography: true,
    enableAmbientGlow: true,
  } as never;
  const trustCount = n === 3 ? 3 : n === 2 ? 2 : 4;
  const trust = {
    id: "t",
    type: "trust_badges",
    enabled: true,
    spacing: "compact",
    background: "default",
    reveal: "none",
    variant: di === 3 ? "compact_strip" : "cards",
    items: facts.slice(0, trustCount).map((f) => ({ icon: f.icon, title: f.title, text: f.detail, fact: f.key })),
  } as never;
  const story = {
    id: "s",
    type: "brand_story",
    enabled: true,
    spacing: "normal",
    background: "default",
    reveal: "none",
    variant: "split",
    title: "من ورشة صغيرة في المنصورة",
    body: "بدأت الحكاية من حب الخياطة وتفاصيلها. كل قطعة بنختارها بنفسنا ونجربها قبل ما توصلك، لأننا عايزين اللي تلبسيه يعبر عنك.",
    quote: "الأناقة مش في الغالي، في اللي يناسبك.",
    image: { url: img("labstory"), alt: "", focalX: 0.5, focalY: 0.5 },
  } as never;
  const faq = {
    id: "f",
    type: "faq",
    enabled: true,
    spacing: "normal",
    background: "muted",
    reveal: "none",
    variant: "accordion",
    title: "قبل ما تطلبي",
    subtitle: "إجابات سريعة لأكتر الأسئلة",
    items: [
      { q: "المقاسات متاحة لحد كام؟", a: "من S لحد 3XL حسب الموديل، والمقاس مكتوب في صفحة كل منتج." },
      { q: "الشحن بياخد قد إيه؟", a: facts.find((f) => f.key === "fast_delivery")?.detail ?? "من 2 إلى 4 أيام عمل." },
      { q: "لو المنتج وصل فيه عيب؟", a: "ابعتيلنا صورة وهنستبدله لك فوراً." },
    ],
  } as never;

  return (
    <div dir="rtl">
      <style dangerouslySetInnerHTML={{ __html: themeStyleSheet(bp.theme, ".storefront") + designStyleSheet(bp, ".storefront") }} />
      <nav className="sticky top-0 z-50 flex flex-wrap gap-2 bg-black p-2 text-xs text-white">
        {PRESETS.map((p, i) => (
          <a key={p.name} href={`?d=${i}&n=${n}`} className={i === di ? "rounded bg-white px-2 py-1 text-black" : "rounded bg-white/10 px-2 py-1"}>
            {p.name}
          </a>
        ))}
        {[1, 2, 3, 4, 5, 6, 9, 12].map((k) => (
          <a key={k} href={`?d=${di}&n=${k}`} className={k === n ? "rounded bg-white px-2 py-1 text-black" : "rounded bg-white/20 px-2 py-1"}>
            {k} منتج
          </a>
        ))}
      </nav>
      <div className="storefront flex min-h-dvh flex-col" data-theme-mode={bp.theme.mode} data-motion={bp.design.motion.level} data-depth="on">
        <div className="s-progress" aria-hidden="true" />
        <DepthController />
        <StoreLab bp={bp} facts={facts} n={n}>
          <Hero s={hero} />
          <TrustBadges s={trust} />
        </StoreLab>
        <BrandStory s={story} />
        <Faq s={faq} />
      </div>
    </div>
  );
}
