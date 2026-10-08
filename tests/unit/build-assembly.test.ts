import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
let respond: () => Promise<unknown> = async () => ({});
vi.mock("@/ai/runner", () => ({ callAIJson: () => respond() }));
// assemble يقرأ القاعدة فقط في validateBlueprintUniqueness (غير مستخدمة هنا)؛ نعزلها احتياطاً.
vi.mock("@/db/client", () => ({ db: {} }));

const { designStore, writeStore } = await import("@/ai/build/studio");
const { composeHome } = await import("@/ai/build/art-director");
const { assemble, fallbackPlan } = await import("@/ai/build/composer");
const { blueprintSchema } = await import("@/blueprint/schema");
const { repairBlueprint } = await import("@/blueprint/repair");

const intake = {
  brief: { storeName: "بيت العسل", industry: "food", phone: "01012345678", features: { faqSection: true }, toneOfVoice: "friendly_egyptian" },
  policies: { cod: true, vodafoneCashNumber: "01098765432", inspectionAllowed: true, returnDays: 7, allowExchange: true, allowRefund: false, defectPolicy: "replace" as const, freeShippingOverEgp: 800, deliveryDays: { min: 1, max: 3 } },
  products: Array.from({ length: 7 }, (_, i) => ({ name: `عسل ${i + 1}`, price: 150 + i * 20, imageUrl: `https://x.ufs.sh/f/${i}`, bestSeller: i === 0 })),
  assets: { logoUrl: "https://x.ufs.sh/f/logo" },
};
const stats = {
  products: intake.products.map((p, i) => ({ slug: `honey-${i}`, name: p.name, image: p.imageUrl, bestSeller: p.bestSeller, onSale: false })),
  categories: [
    { slug: "sidr", name: "سدر", count: 4 },
    { slug: "flowers", name: "زهور", count: 3 },
  ],
};

async function build(ai: { design: unknown; copy: unknown }) {
  const plan = fallbackPlan(intake);
  respond = async () => ai.design;
  const design = await designStore(intake, plan, "s1", []);
  respond = async () => ai.copy;
  const copy = await writeStore(intake, plan, design, "s1", []);
  const home = composeHome({ copy, design, stats, features: intake.brief.features });
  const bp = await assemble({ plan, theme: design.theme, studio: { design, copy }, home, pages: [], catalog: {}, intake }, "s1");
  return { bp, design, copy };
}

describe("full build assembly", () => {
  it("produces a schema-valid blueprint from a rich AI response, with no repair needed", async () => {
    const { bp } = await build({
      design: { concept: "شهد الريف", palette: { background: "#fff8ec", primary: "#9a4a07", accent: "#e0a526" }, fonts: { heading: "noto_kufi", body: "cairo" }, design: { card: { ratio: "square" } }, cardStyle: "bordered", heroVariant: "collage", css: ".s-card{border-radius:4px}" },
      copy: {
        hero: { eyebrow: "من المنحل", headline: "عسل سدر خام من غير ولا إضافة", subheadline: "نجمعه من مناحلنا ونعبيه بإيدينا", primaryCta: "اطلب عسلك" },
        announcements: [{ fact: "free_shipping_over", text: "شحن مجاني فوق 800 ج" }, { fact: "cod", text: "ادفع لما يوصلك" }],
        trust: [{ fact: "inspection", title: "عاين قبل ما تدفع", icon: "eye" }, { fact: "cod", title: "ادفع عند الاستلام", icon: "banknote" }, { fact: "returns", title: "استبدال 7 أيام", icon: "repeat" }],
        sections: { featured: { title: "الأكثر طلباً" }, faq: { title: "أسئلتك", subtitle: "كل اللي محتاج تعرفه" }, reviews: { title: "قالوا عنا", subtitle: "آراء حقيقية" } },
        story: { title: "منحل العيلة", body: "من أكتر من جيل والعيلة بتربي النحل في الريف، وبنختار كل برطمان بنفسنا عشان يوصلك عسل حقيقي زي ما بناكله في بيوتنا بالظبط." },
        faq: [{ q: "العسل خام؟", a: "أيوه، من غير تسخين ولا سكر." }, { q: "ينفع أعاين؟", a: "طبعاً، افتح الشحنة وعاين قبل ما تدفع." }, { q: "الشحن مجاني؟", a: "مجاني فوق 800 جنيه." }],
        microcopy: { addToCart: "حطه في السلة", buyNow: "اطلبه دلوقتي" },
        seo: { title: "بيت العسل | عسل سدر خام", description: "عسل طبيعي من المنحل لبيتك" },
        orderMessages: { confirmed: "أهلاً {name}، طلبك {code} اتأكد." },
      },
    });
    const parsed = blueprintSchema.safeParse(bp);
    expect(parsed.success ? [] : parsed.error.issues.slice(0, 3)).toEqual([]);
    const { report } = repairBlueprint(bp, { name: "بيت العسل", storeId: "s1" });
    expect(report.repaired).toBe(false);
    const home = parsed.success ? parsed.data.home : [];
    expect(home.map((s) => s.type)).toEqual(["announcement", "hero", "trust_badges", "categories", "product_grid", "brand_story", "testimonials", "faq"]);
    expect(parsed.success && parsed.data.brand.logo?.url).toBe("https://x.ufs.sh/f/logo");
    expect(parsed.success && parsed.data.copy.addToCart).toBe("حطه في السلة");
    const faq = home.find((s) => s.type === "faq");
    expect(faq && "subtitle" in faq ? faq.subtitle : undefined).toBe("كل اللي محتاج تعرفه");
  });

  it("still produces a valid store when every AI call fails", async () => {
    const plan = fallbackPlan(intake);
    respond = async () => {
      throw new Error("down");
    };
    const design = await designStore(intake, plan, "s1", []);
    const copy = await writeStore(intake, plan, design, "s1", []);
    const home = composeHome({ copy, design, stats });
    const bp = await assemble({ plan, theme: design.theme, studio: { design, copy }, home, pages: [], catalog: {}, intake }, "s1");
    expect(blueprintSchema.safeParse(bp).success).toBe(true);
    expect(JSON.stringify(bp.home)).not.toContain("أهلاً");
  });
});
