import { describe, expect, it } from "vitest";
import { sanitizeSkinCss } from "@/blueprint/skin";
import { designStyleSheet } from "@/blueprint/design";
import { storeFacts, groundedItems, claimedFact } from "@/blueprint/facts";
import { blueprintSchema, designSchema } from "@/blueprint/schema";
import { defaultBlueprint } from "@/blueprint/defaults";
import { composeHome } from "@/ai/build/art-director";
import { balancedColumns } from "@/components/blocks/ProductGrid";
import { ICON_NAMES } from "@/blueprint/icons";
import { KNOWN_ICONS } from "@/components/storefront/Icon";
import type { StudioCopy, StudioDesign } from "@/ai/build/studio";

const bp = blueprintSchema.parse(defaultBlueprint({ name: "متجر", storeId: "s" } as never));

describe("skin css sanitizer", () => {
  it("keeps cosmetic rules on hooks and scopes them", () => {
    const out = sanitizeSkinCss(".s-card{border-radius:30px;box-shadow:0 0 0 1px red;display:none} .s-btn:hover{transform:scale(1.02)}");
    expect(out).toContain(".storefront .s-card{border-radius:30px;box-shadow:0 0 0 1px red}");
    expect(out).not.toContain("display");
    expect(out).toContain(".storefront .s-btn:hover{transform:scale(1.02)}");
  });
  it("drops anything dangerous or layout-breaking", () => {
    const out = sanitizeSkinCss(
      "@import url(x.css); body{color:red} .s-card{background:url(https://evil/x.png)} p{color:red} .s-title{position:fixed;width:9999px} </style><script>alert(1)</script>"
    );
    expect(out).toBe("");
    expect(sanitizeSkinCss(".s-card{color:red}</style>")).toBe("");
  });
  it("never emits a broken rule when truncating", () => {
    const big = Array.from({ length: 400 }, (_, i) => `.s-card[data-x="${i}"]{color:#${String(i % 999).padStart(3, "0")}}`).join("");
    const out = sanitizeSkinCss(big);
    expect(out.length).toBeLessThanOrEqual(6000);
    expect(out.endsWith("}")).toBe(true);
  });
});

describe("design stylesheet", () => {
  it("compiles any design (defaults and extremes) without throwing", () => {
    expect(designStyleSheet(bp)).toContain("--r-card:16px");
    const extreme = designSchema.parse({ surface: { background: "waves", divider: "wave", rhythm: "bands", grain: true }, card: { hover: "swap", badge: "ribbon" }, button: { fill: "glass" }, heading: { style: "ornament" } });
    const css = designStyleSheet({ ...bp, design: extreme, theme: { ...bp.theme, productCardStyle: "brutalist" } });
    expect(css).toContain("s-section[data-tone=alt]");
    expect(css).not.toContain("undefined");
  });
});

describe("facts", () => {
  const strict = { ...bp, returns: { ...bp.returns, windowDays: 0, allowExchange: false, allowRefund: false, defectPolicy: "none" as const }, shipping: { ...bp.shipping, inspectionAllowed: false } };
  it("a store without returns or inspection never claims them", () => {
    const facts = storeFacts(strict, { activeGovernorates: 27 });
    const keys = facts.map((f) => f.key);
    expect(keys).not.toContain("returns");
    expect(keys).not.toContain("inspection");
    expect(keys).not.toContain("defect");
    const items = groundedItems(
      [
        { icon: "eye", title: "معاينة قبل الدفع" },
        { icon: "rotate-ccw", title: "استرجاع 14 يوم" },
        { icon: "banknote", title: "الدفع عند الاستلام" },
        { icon: "truck", title: "شحن لكل مصر" },
        { icon: "sparkles", title: "تصميمات حصرية" },
      ],
      facts
    );
    expect(items.map((i) => i.title)).toEqual(["الدفع عند الاستلام", "شحن لكل مصر", "تصميمات حصرية"]);
  });
  it("coverage claims follow the real active governorates", () => {
    const few = storeFacts(bp, { activeGovernorates: 5 });
    expect(groundedItems([{ title: "شحن لكل محافظات مصر" }], few)).toEqual([]);
    expect(few.find((f) => f.key === "coverage")?.title).toBe("شحن إلى 5 محافظة");
  });
  it("rewrites a badge whose number is outdated, and drops an outdated FAQ answer", () => {
    const seven = storeFacts({ ...bp, returns: { ...bp.returns, windowDays: 7 } });
    const [badge] = groundedItems([{ fact: "returns", title: "استرجاع خلال 14 يوماً", text: "خلال 14 يوم" }], seven);
    expect(badge?.title).toContain("7");
    expect(groundedItems([{ title: "مدة الاسترجاع؟", text: "تقدر ترجع المنتج خلال 14 يوم" }], seven, "drop")).toEqual([]);
    expect(groundedItems([{ title: "مدة الاسترجاع؟", text: "خلال 7 أيام" }], seven, "drop")).toHaveLength(1);
  });
    it("detects claims in free text", () => {
    expect(claimedFact("افحص المنتج مع المندوب")).toBe("inspection");
    expect(claimedFact("قطع مختارة بعناية")).toBeNull();
  });
});

describe("art director", () => {
  const copy: StudioCopy = {
    brandTagline: "x",
    hero: { headline: "عنوان", primaryCta: "تسوّق" },
    announcements: [{ fact: "cod", text: "ادفع عند الاستلام" }],
    trust: [
      { fact: "cod", title: "الدفع عند الاستلام", icon: "banknote" },
      { fact: "nationwide", title: "شحن لكل مصر", icon: "truck" },
      { fact: "whatsapp", title: "واتساب", icon: "message-circle" },
    ],
    sections: {},
    story: { body: "قصة طويلة بما يكفي لتظهر في الصفحة الرئيسية للمتجر بدون مشاكل على الإطلاق." },
    faq: [
      { q: "a", a: "b" },
      { q: "c", a: "d" },
      { q: "e", a: "f" },
    ],
    footerTagline: "",
    microcopy: {},
    seo: {},
    orderMessages: {},
  };
  const design = { design: designSchema.parse({}), heroVariant: "split", headerVariant: "classic", footerVariant: "rich", customCss: "", theme: bp.theme } as StudioDesign;
  const product = (i: number) => ({ slug: `p${i}`, name: `منتج ${i}`, image: `https://x.ufs.sh/f/${i}` });

  it("one product becomes a spotlight, and a single category shows no categories section", () => {
    const home = composeHome({ copy, design, stats: { products: [product(1)], categories: [{ slug: "a", name: "أ", count: 1 }] } });
    expect(home.some((s) => s.type === "categories")).toBe(false);
    expect(home.find((s) => s.type === "product_grid")).toMatchObject({ variant: "spotlight" });
  });
  it("respects features the merchant turned off", () => {
    const home = composeHome({ copy, design, stats: { products: [1, 2, 3].map(product), categories: [] }, features: { trustBadges: false, marqueeBanner: false, faqSection: false } });
    const types = home.map((s) => s.type);
    expect(types).not.toContain("trust_badges");
    expect(types).not.toContain("announcement");
    expect(types).not.toContain("faq");
  });
  it("never repeats the same tone on adjacent content sections", () => {
    const home = composeHome({ copy, design, stats: { products: Array.from({ length: 12 }, (_, i) => product(i)), categories: [{ slug: "a", name: "أ", count: 6 }, { slug: "b", name: "ب", count: 6 }] } });
    const tones = home.filter((s) => s.type !== "announcement" && s.type !== "hero").map((s) => s.background);
    for (let i = 1; i < tones.length; i++) expect(tones[i]).not.toBe(tones[i - 1]);
  });
});

describe("product grid columns", () => {
  it("chooses columns that leave no or one empty slot", () => {
    expect(balancedColumns(3, 4)).toBe(3);
    expect(balancedColumns(6, 4)).toBe(3);
    expect(balancedColumns(8, 4)).toBe(4);
    expect(balancedColumns(2, 4)).toBe(2);
    expect(balancedColumns(5, 4)).toBe(3);
  });
});

describe("icons", () => {
  it("every icon the AI may pick is drawable", () => {
    for (const n of ICON_NAMES) expect(KNOWN_ICONS.has(n)).toBe(true);
  });
});
