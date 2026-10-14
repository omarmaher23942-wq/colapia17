// مولَّد من مجلدات stores/ بواسطة scripts/stores/registry.ts — لا تعدّله يدوياً.
// يُعاد توليده تلقائياً قبل dev وbuild، ويفحص CI أنه مطابق (npm run stores:check).
import type { StoreEntry } from "./types";

export const STORE_REGISTRY: Record<string, StoreEntry> = {
  "atelier": {
    meta: {"slug":"atelier","name":"أتيليه طين"},
    theme: "/* جلد أتيليه طين: ألوان الطين المحروق وحواف مستديرة ناعمة. كل القواعد داخل .storefront. */\n.storefront {\n  --atelier-clay: #b4532a;\n  --atelier-sand: #f4ece1;\n}\n.storefront .s-card { border-radius: 22px; }\n.storefront .atelier-ribbon {\n  background: var(--atelier-clay);\n  color: #fff;\n}\n.storefront .atelier-step {\n  background: var(--atelier-sand);\n  color: #3b2416;\n  border-radius: 20px;\n}\n/* عناوين الأقسام تأخذ لونها من نبرة القسم في النواة؛ البطاقة الفاتحة تحتاج لونها صراحة. */\n.storefront .atelier-step :is(h3, p, span, svg) { color: #3b2416; }\n",
    sections: {
      "trust_badges": () => import("../../stores/atelier/sections/trust_badges"),
    },
    blocks: {
      "craft-process": () => import("../../stores/atelier/blocks/craft-process"),
    },
    slots: {
      "Header": () => import("../../stores/atelier/slots/Header"),
    },
    pages: {
      "craft": () => import("../../stores/atelier/pages/craft"),
    },
  },
  "nor-llmlabs": {
    meta: {"slug":"nor-llmlabs","name":"نور للملابس"},
    theme: "/* جلد نور للملابس: عاجي دافئ وزيتوني ناعم، صور القطع هي البطل. كل القواعد داخل .storefront وبمتغيرات الثيم. */\n.storefront {\n  --noor-olive: #4a5326;\n  --noor-sage: #acb776;\n  --noor-ink: #1d2015;\n}\n\n/* العناوين الكبيرة أخف قليلاً وأكثر أناقة مع خط المسيري. */\n.storefront .s-display { letter-spacing: 0; line-height: 1.15; }\n.storefront .s-eyebrow { color: var(--noor-olive); letter-spacing: 0.02em; }\n\n/* الزر الأساسي: زيتوني فاتح بحبر داكن (تباين > 7:1)، وتأكيد خفيف عند المرور واللمس. */\n.storefront .s-btn {\n  box-shadow: 0 1px 0 rgb(255 255 255 / 0.5) inset, 0 8px 22px -12px color-mix(in srgb, var(--noor-olive) 70%, transparent);\n  transition: transform 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;\n}\n.storefront .s-btn:hover { background: color-mix(in srgb, var(--noor-sage) 88%, var(--noor-olive)); }\n.storefront .s-btn:active { transform: translateY(1px) scale(0.99); }\n\n/* صور الواجهة: إطار ناعم وظل دافئ. */\n.storefront .s-hero-media {\n  box-shadow: 0 30px 60px -38px rgb(29 32 21 / 0.55);\n  outline: 1px solid rgb(255 255 255 / 0.6);\n  outline-offset: -1px;\n}\n\n/* بطاقة المنتج: السعر بلون الحبر، والاسم أوضح. */\n.storefront .s-card .s-price { color: var(--noor-ink); }\n\n/* لوحات الأقسام (sections/categories.tsx). */\n.storefront .noor-tile {\n  aspect-ratio: 3 / 4;\n  border-radius: 20px;\n  background: linear-gradient(160deg, color-mix(in srgb, var(--noor-sage) 35%, var(--background)), var(--muted));\n  isolation: isolate;\n}\n@media (min-width: 640px) { .storefront .noor-tile { aspect-ratio: 4 / 5; } }\n@media (min-width: 1024px) { .storefront .noor-tile { aspect-ratio: 5 / 4; } }\n.storefront .noor-tile-img { z-index: -2; transition: transform 0.7s cubic-bezier(0.2, 0.7, 0.2, 1); }\n.storefront .noor-tile-shade { z-index: -1; background: linear-gradient(to top, rgb(20 22 14 / 0.78), rgb(20 22 14 / 0.12) 55%, transparent); }\n.storefront .noor-tile:hover .noor-tile-img { transform: scale(1.04); }\n.storefront .noor-tile:focus-visible { outline: 3px solid var(--noor-sage); outline-offset: 3px; }\n.storefront .noor-tile-name { color: #fff; font-size: clamp(1.25rem, 4.5vw, 2.25rem); font-weight: 700; line-height: 1.2; }\n.storefront .noor-tile-meta { color: rgb(255 255 255 / 0.88); font-size: 13px; font-weight: 600; }\n.storefront .noor-tile-go {\n  width: 44px; height: 44px; border-radius: 999px;\n  background: var(--noor-sage); color: #1b1f10;\n  transition: transform 0.25s ease;\n}\n.storefront .noor-tile:hover .noor-tile-go { transform: translateX(-4px); }\n\n@media (prefers-reduced-motion: reduce) {\n  .storefront .noor-tile-img, .storefront .noor-tile-go, .storefront .s-btn { transition: none; }\n  .storefront .noor-tile:hover .noor-tile-img, .storefront .noor-tile:hover .noor-tile-go { transform: none; }\n}\n",
    sections: {
      "categories": () => import("../../stores/nor-llmlabs/sections/categories"),
    },
    blocks: {},
    slots: {},
    pages: {},
  },
  "nova": {
    meta: {"slug":"nova","name":"نوفا ستايل"},
    theme: "/* جلد نوفا ستايل: أزرار بحواف حادة وعناوين أعرض. */\n.storefront .s-btn { border-radius: 4px; letter-spacing: 0.01em; }\n.storefront .s-title { letter-spacing: -0.01em; }\n",
    sections: {
      "faq": () => import("../../stores/nova/sections/faq"),
    },
    blocks: {},
    slots: {},
    pages: {},
  },
};
