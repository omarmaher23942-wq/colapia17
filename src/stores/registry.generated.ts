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
  "myada-fashon": {
    meta: {"slug":"myada-fashon","name":"ميادة فاشون"},
    theme: "/* جلد ميادة فاشون: لمسات رقيقة فوق نظام التصميم */\n.storefront .s-btn { letter-spacing: 0; }\n.storefront .s-card { border-color: var(--border); }\n.storefront .s-media img { object-position: center 35%; }\n.storefront .s-announce { letter-spacing: 0; }\n",
    sections: {},
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
