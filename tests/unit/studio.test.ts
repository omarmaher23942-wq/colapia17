import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// استجابة النموذج المحاكى لكل اختبار (دالة عادية بدل vi.fn حتى لا تُحسب أخطاؤها المقصودة كفشل).
let respond: () => Promise<unknown> = async () => ({});
const aiResponse = {
  mockReset: () => (respond = async () => ({})),
  mockResolvedValue: (v: unknown) => (respond = async () => v),
  mockImplementation: (fn: () => Promise<unknown>) => (respond = fn),
};
vi.mock("@/ai/runner", () => ({ callAIJson: () => respond() }));

const { designStore, writeStore } = await import("@/ai/build/studio");
const { fallbackPlan } = await import("@/ai/build/plan");
const { contrastRatio } = await import("@/blueprint/palette");
const { designSchema } = await import("@/blueprint/schema");

const intake = {
  brief: { storeName: "مياده فاشون", industry: "fashion", phone: "01012345678", whatsappNumber: "01012345678", features: {}, toneOfVoice: "luxury", autoTheme: false, colorPreference: "#7a1f3d بنفسجي" },
  policies: { cod: true, inspectionAllowed: false, returnDays: 0, allowExchange: false, allowRefund: false, defectPolicy: "none" as const, deliveryDays: { min: 2, max: 3 } },
  products: [
    { name: "فستان سهرة ستان", price: 1450, imageUrl: "https://x.ufs.sh/f/a", bestSeller: true },
    { name: "بلوزة شيفون", price: 520, imageUrl: "https://x.ufs.sh/f/b" },
  ],
};
const plan = fallbackPlan(intake);

describe("art director (design)", () => {
  beforeEach(() => aiResponse.mockReset());

  it("keeps valid AI choices, rejects invalid ones, and enforces merchant color and contrast", async () => {
    aiResponse.mockResolvedValue({
      concept: "حرير المساء",
      mood: "هادئ وفاخر",
      mode: "light",
      palette: { background: "#faf7f2", foreground: "#cccccc", primary: "#00ff00", accent: "#c9a46a", card: "#ffffff", muted: "#f1ebe2", border: "#e5dccf" },
      fonts: { heading: "el_messiri", body: "comic_sans" },
      design: { shape: { card: 6, button: 9999 }, card: { ratio: "tall", hover: "explode" }, surface: { background: "paper" }, type: { headingWeight: "650" } },
      cardStyle: "editorial",
      motion: "subtle",
      heroVariant: "collage",
      headerVariant: "centered_logo",
      footerVariant: "weird",
      css: ".s-card{border-radius:2px}",
    });
    const degraded: { unit: string; reason: string }[] = [];
    const d = await designStore(intake, plan, "store-1", degraded);
    expect(d.theme.palette.primary).toBe("#7a1f3d"); // لون التاجر يفوز على اختيار الـ AI
    expect(contrastRatio(d.theme.palette.foreground, d.theme.palette.background)).toBeGreaterThanOrEqual(7); // #cccccc مرفوض
    expect(d.theme.fonts.heading).toBe("el_messiri");
    expect(d.design.shape.card).toBe(6);
    expect(d.design.shape.button).toBe(14); // 9999 خارج المسموح فيبقى الافتراضي
    expect(d.design.card.ratio).toBe("tall");
    expect(d.design.card.hover).toBe("zoom"); // قيمة غير معروفة ← الافتراضي
    expect(d.design.type.headingWeight).toBe(650); // رقم مكتوب كنص يُقبل
    expect(d.heroVariant).toBe("split"); // collage يحتاج 3 صور ولدينا 2
    expect(d.footerVariant).toBe("rich");
    expect(d.design.concept).toBe("حرير المساء");
  });

  it("falls back to a seeded design when the AI fails", async () => {
    aiResponse.mockImplementation(async () => {
      throw new Error("all providers failed");
    });
    const degraded: { unit: string; reason: string }[] = [];
    const d = await designStore(intake, plan, "store-1", degraded);
    expect(degraded[0]?.unit).toBe("design");
    expect(d.theme.palette.primary).toBe("#7a1f3d");
  });
});

describe("copywriter", () => {
  beforeEach(() => aiResponse.mockReset());
  const design = { design: designSchema.parse({}), heroVariant: "split" as const };

  it("drops claims the store does not make and greeting headlines", async () => {
    aiResponse.mockResolvedValue({
      brandTagline: "فساتين سهرة تليق بك",
      hero: { headline: "أهلاً بك في متجرنا", subheadline: "فساتين سهرة 🎉 مختارة", primaryCta: "تسوقي الآن" },
      announcements: [{ fact: "inspection", text: "معاينة قبل الدفع" }, { fact: "brand", text: "تشكيلة الشتاء وصلت" }, { fact: "cod", text: "ادفعي عند الاستلام" }],
      trust: [
        { fact: "returns", title: "استرجاع 14 يوم", text: "", icon: "rotate-ccw" },
        { fact: "cod", title: "الدفع عند الاستلام", text: "ادفعي للمندوب", icon: "unknown-icon" },
        { fact: "cod", title: "مكرر", icon: "banknote" },
      ],
      faq: [
        { q: "هل يمكن الاسترجاع؟", a: "نعم خلال 14 يوم" },
        { q: "المقاسات؟", a: "من S إلى XL" },
      ],
      microcopy: { addToCart: "ضيفيه للشنطة", lowStock: "باقي {n} بس" },
      sections: { featured: { title: "الأكثر طلباً" } },
      story: { body: "قصيرة" },
      orderMessages: { confirmed: "تم تأكيد طلبك {code}", shipped: "بدون متغير الكود" },
    });
    const degraded: { unit: string; reason: string }[] = [];
    const c = await writeStore(intake, plan, design, "store-1", degraded);
    expect(c.hero.headline).not.toContain("أهلاً");
    expect(c.hero.subheadline).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(c.announcements.map((a) => a.text)).toEqual(["تشكيلة الشتاء وصلت", "ادفعي عند الاستلام"]);
    expect(c.trust.map((t) => t.fact)).not.toContain("returns");
    expect(new Set(c.trust.map((t) => t.fact)).size).toBe(c.trust.length);
    expect(c.trust.find((t) => t.fact === "cod")?.icon).toBe("banknote");
    expect(c.faq.some((f) => f.q.includes("الاسترجاع"))).toBe(false);
    expect(c.microcopy.addToCart).toBe("ضيفيه للشنطة");
    expect(c.orderMessages.confirmed).toContain("{code}");
    expect(c.orderMessages.shipped).toBeUndefined();
  });

  it("derives honest copy from the store's own data when the AI fails", async () => {
    aiResponse.mockImplementation(async () => {
      throw new Error("down");
    });
    const degraded: { unit: string; reason: string }[] = [];
    const c = await writeStore(intake, plan, design, "store-1", degraded);
    expect(c.hero.headline).toBe("مياده فاشون");
    expect(c.trust.every((t) => ["cod", "nationwide", "fast_delivery", "whatsapp"].includes(t.fact))).toBe(true);
  });
});
