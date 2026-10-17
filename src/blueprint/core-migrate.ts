// core-migrate.ts — تحويل أي Blueprint قديم إلى تصميم Core عند القراءة (لا تعديل في القاعدة):
//  - شريط الإعلانات صار في header.announcement بدل قسم في الرئيسية.
//  - الواجهة ثلاثة تخطيطات فقط: فيديو، صورة جانبية (split)، منتج بطل.
//  - الأقسام دوائر أو بلاطات فقط.
//  - بلا حركات استعراضية (دوران، ميل ثلاثي الأبعاد، كشف كلمة كلمة، أنماط خلفية).
import type { Section, StoreBlueprint } from "./schema";

type Hero = Extract<Section, { type: "hero" }>;
type Cats = Extract<Section, { type: "categories" }>;

export function coreHeroVariant(h: Pick<Hero, "videoUrl" | "images">): "video" | "split" | "product_spotlight" {
  if (h.videoUrl) return "video";
  return h.images.length ? "split" : "product_spotlight";
}

const CIRCLE_VARIANTS = new Set(["circles", "stories", "scroll", "marquee"]);
export const coreCategoriesVariant = (v: string): "circles" | "grid" => (CIRCLE_VARIANTS.has(v) ? "circles" : "grid");

export function migrateToCore(bp: StoreBlueprint): StoreBlueprint {
  let announcement = bp.header.announcement;
  const home: Section[] = [];
  for (const s of bp.home) {
    if (s.type === "announcement") {
      if (!announcement && s.enabled && s.messages.length) {
        announcement = { enabled: true, items: s.messages.slice(0, 5).map((m) => ({ text: m.text, target: m.target })), dismissible: s.dismissible ?? true, rotate: true };
      }
      continue;
    }
    if (s.type === "hero") {
      home.push({ ...s, variant: coreHeroVariant(s), reveal: "fade", enableKineticTypography: false, enableParallax: false, enableAmbientGlow: false });
      continue;
    }
    if (s.type === "categories") {
      home.push({ ...s, variant: coreCategoriesVariant(s.variant), reveal: s.reveal === "kinetic" ? "fade" : s.reveal } as Cats);
      continue;
    }
    home.push(s.reveal === "kinetic" ? ({ ...s, reveal: "fade" } as Section) : s);
  }
  return {
    ...bp,
    header: { ...bp.header, announcement },
    home,
    theme: { ...bp.theme, backgroundPattern: "none", ambientBackdrop: undefined },
    design: { ...bp.design, motion: { ...bp.design.motion, level: "calm", depth: false } },
  };
}
