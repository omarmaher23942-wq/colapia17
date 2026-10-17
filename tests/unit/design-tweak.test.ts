import { describe, expect, it } from "vitest";
import { defaultBlueprint } from "@/blueprint/defaults";
import { blueprintSchema } from "@/blueprint/schema";
import { contrastRatio } from "@/blueprint/palette";
import { applyHeroMedia, applyTweak, describeColor, guardContrast, isTweakKey, summarizeTweak, tweakResponseSchema } from "@/lib/design-tweak";
import { diffBlueprint } from "@/lib/blueprint-patch";

const base = () => blueprintSchema.parse(defaultBlueprint({ name: "متجر الاختبار", industry: "fashion" }));

describe("قائمة التعديل البيضاء", () => {
  it("يرفض أي مفتاح خارج القائمة ولا يغيّر شيئاً", () => {
    const bp = base();
    const r = applyTweak(bp, [
      { key: "customCss", value: "body{display:none}" },
      { key: "payments.cod.enabled", value: false },
      { key: "brand.name", value: "اسم آخر" },
      { key: "__proto__", value: "x" },
    ]);
    expect(r.changes).toEqual([]);
    expect(r.rejected).toHaveLength(4);
    expect(diffBlueprint(bp as never, r.blueprint as never)).toEqual([]);
  });
  it("isTweakKey لا يقبل خصائص Object.prototype", () => {
    expect(isTweakKey("constructor")).toBe(false);
    expect(isTweakKey("toString")).toBe(false);
    expect(isTweakKey("corners")).toBe(true);
  });
  it("مخطط رد النموذج يقبل مفتاحاً غريباً (يُرفض لاحقاً بالتطبيق لا بالمخطط)", () => {
    expect(tweakResponseSchema.safeParse({ ops: [{ key: "x", value: "y" }] }).success).toBe(true);
    expect(tweakResponseSchema.safeParse({ ops: Array.from({ length: 20 }, () => ({ key: "corners", value: "soft" })) }).success).toBe(false);
  });
});

describe("تطبيق التعديلات", () => {
  it("حجم الخط والزوايا والأزرار والكثافة", () => {
    const r = applyTweak(base(), [
      { key: "text.size", value: "larger" },
      { key: "corners", value: "pill" },
      { key: "button.style", value: "outline" },
      { key: "density", value: "airy" },
    ]);
    expect(r.blueprint.theme.fonts.baseSize).toBe(18);
    expect(r.blueprint.theme.radius).toBe("full");
    expect(r.blueprint.design.shape.button).toBe(999);
    expect(r.blueprint.theme.buttonStyle).toBe("outline");
    expect(r.blueprint.design.layout.density).toBe("airy");
    expect(r.changes).toHaveLength(4);
    expect(blueprintSchema.safeParse(r.blueprint).success).toBe(true);
  });
  it("قيمة غير معروفة تُرفض بسببها", () => {
    const r = applyTweak(base(), [{ key: "text.size", value: "gigantic" }, { key: "corners", value: 5 }]);
    expect(r.changes).toEqual([]);
    expect(r.rejected).toHaveLength(2);
  });
  it("تغيير لون الخلفية للأبيض يبقي النص مقروءاً (AA) ويصف التغيير", () => {
    const r = applyTweak(base(), [{ key: "color.background", value: "#ffffff" }]);
    const p = r.blueprint.theme.palette;
    expect(contrastRatio(p.foreground, p.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.primaryForeground, p.primary)).toBeGreaterThanOrEqual(4.5);
    expect(r.changes[0]).toContain("الأبيض");
  });
  it("خلفية داكنة ينقلب معها الوضع وتبقى النصوص مقروءة", () => {
    const r = applyTweak(base(), [{ key: "color.background", value: "#101820" }]);
    const p = r.blueprint.theme.palette;
    expect(r.blueprint.theme.mode).toBe("dark");
    expect(contrastRatio(p.foreground, p.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.mutedForeground, p.background)).toBeGreaterThanOrEqual(4.5);
  });
  it("لون نص يطابق الخلفية يُصلح تلقائياً", () => {
    const r = applyTweak(base(), [{ key: "color.foreground", value: "#fafafa" }, { key: "color.background", value: "#ffffff" }]);
    const p = r.blueprint.theme.palette;
    expect(contrastRatio(p.foreground, p.background)).toBeGreaterThanOrEqual(4.5);
  });
  it("لون غير صالح", () => {
    const r = applyTweak(base(), [{ key: "color.primary", value: "red; background:url(x)" }]);
    expect(r.changes).toEqual([]);
    expect(r.rejected[0]).toContain("لون");
  });
  it("زوج الخطوط من القائمة فقط", () => {
    const ok = applyTweak(base(), [{ key: "fonts.pair", value: "elegant" }]);
    expect(ok.blueprint.theme.fonts.heading).toBe("el_messiri");
    const bad = applyTweak(base(), [{ key: "fonts.pair", value: "comic" }]);
    expect(bad.changes).toEqual([]);
  });
  it("إخفاء الأقسام لا يلمس الواجهة ولا شريط الإعلان", () => {
    const bp = base();
    const types = bp.home.map((s) => s.type);
    const r = applyTweak(bp, [{ key: "sections.hide", value: ["hero", "announcement", ...types.filter((t) => t === "faq" || t === "categories")] }]);
    expect(r.blueprint.home.find((s) => s.type === "hero")!.enabled).not.toBe(false);
    expect(r.rejected.length).toBeGreaterThanOrEqual(2);
    for (const s of r.blueprint.home) if (s.type === "faq" || s.type === "categories") expect(s.enabled).toBe(false);
  });
  it("ترتيب الأقسام يبقي الواجهة والإعلان في الأعلى", () => {
    const bp = base();
    const movable = bp.home.filter((s) => s.type !== "hero" && s.type !== "announcement").map((s) => s.type);
    if (movable.length < 2) return;
    const reversed = [...new Set(movable)].reverse();
    const r = applyTweak(bp, [{ key: "sections.order", value: reversed }]);
    const afterMovable = r.blueprint.home.filter((s) => s.type !== "hero" && s.type !== "announcement").map((s) => s.type);
    expect(afterMovable[0]).toBe(reversed[0]);
    expect(r.blueprint.home.length).toBe(bp.home.length);
    expect(blueprintSchema.safeParse(r.blueprint).success).toBe(true);
  });
  it("نص الإعلان: ينشئ الشريط إن لم يوجد ويخفيه عند الفراغ", () => {
    const bp = base();
    const withText = applyTweak(bp, [{ key: "announcement.text", value: "شحن مجاني فوق 1000 جنيه" }]);
    const ann = withText.blueprint.home.find((s) => s.type === "announcement");
    expect(ann && ann.type === "announcement" ? ann.messages[0]!.text : "").toBe("شحن مجاني فوق 1000 جنيه");
    expect(blueprintSchema.safeParse(withText.blueprint).success).toBe(true);
    const hidden = applyTweak(withText.blueprint, [{ key: "announcement.text", value: "" }]);
    expect(hidden.blueprint.home.find((s) => s.type === "announcement")!.enabled).toBe(false);
  });
  it("لا يلمس أي مفتاح خارج theme وdesign وhome", () => {
    const bp = base();
    const r = applyTweak(bp, [
      { key: "color.primary", value: "#16a34a" },
      { key: "text.size", value: "larger" },
      { key: "hero.headline", value: "عنوان جديد" },
      { key: "announcement.text", value: "إعلان" },
    ]);
    const tops = new Set(diffBlueprint(bp as never, r.blueprint as never).map((c) => c.path[0]));
    for (const t of tops) expect(["theme", "design", "home"]).toContain(t);
  });
});

describe("حارس التباين", () => {
  it("يصلح الأزواج الضعيفة ويسمّيها", () => {
    const p = { ...base().theme.palette, foreground: "#f0f0f0", background: "#ffffff", mutedForeground: "#eeeeee" };
    const g = guardContrast(p);
    expect(contrastRatio(g.palette.foreground, g.palette.background)).toBeGreaterThanOrEqual(4.5);
    expect(g.fixes.length).toBeGreaterThan(0);
  });
  it("لا يغيّر لوحة سليمة", () => {
    const p = base().theme.palette;
    expect(guardContrast(p).fixes).toEqual([]);
  });
});

describe("الوصف البشري", () => {
  it("يذكر ما تغيّر بجملة عربية", () => {
    const r = applyTweak(base(), [{ key: "color.background", value: "#ffffff" }, { key: "text.size", value: "larger" }]);
    const s = summarizeTweak(r);
    expect(s).toContain("غيّرنا لون الخلفية إلى الأبيض");
    expect(s).toContain("كبّرنا حجم الخط");
  });
  it("لا تعديلات: رسالة مفهومة أو ملاحظة النموذج", () => {
    const empty = { changes: [], contrastFixes: [], rejected: [] };
    expect(summarizeTweak(empty)).toContain("لم نفهم");
    expect(summarizeTweak(empty, "هذا خارج التعديلات المتاحة")).toBe("هذا خارج التعديلات المتاحة");
  });
  it("أسماء الألوان", () => {
    expect(describeColor("#fefefe")).toBe("الأبيض");
    expect(describeColor("#0a0a0a")).toBe("الأسود");
  });
});

describe("وسائط الواجهة", () => {
  const origin = "https://colapia.com";
  it("فيديو جاهز يضبط الفيديو والغلاف والتخطيط", () => {
    const r = applyHeroMedia(base(), { kind: "video_fashion" }, origin);
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    const hero = r.blueprint.home.find((s) => s.type === "hero")!;
    expect(hero.type === "hero" && hero.videoUrl).toBe("https://colapia.com/demo/media/hero-fashion.mp4");
    expect(hero.type === "hero" && hero.images[0]!.url).toBe("https://colapia.com/demo/media/hero-fashion.jpg");
    expect(hero.type === "hero" && hero.variant).toBe("fullscreen");
    expect(blueprintSchema.safeParse(r.blueprint).success).toBe(true);
  });
  it("فيديو مرفوع بلا غلاف يُرفض بلطف", () => {
    const bp = base();
    const hero = bp.home.find((s) => s.type === "hero");
    if (hero && hero.type === "hero") hero.images = [];
    const r = applyHeroMedia(bp, { kind: "video_upload", url: "https://m.example.com/v.mp4" }, origin);
    expect("error" in r).toBe(true);
  });
  it("تلقائي يزيل الفيديو ويستخدم صور المنتجات", () => {
    const r = applyHeroMedia(base(), { kind: "auto" }, origin, [1, 2, 3, 4].map((i) => ({ url: `https://m.example.com/${i}.jpg`, alt: `م${i}` })));
    if ("error" in r) throw new Error(r.error);
    const hero = r.blueprint.home.find((s) => s.type === "hero")!;
    expect(hero.type === "hero" && hero.videoUrl).toBeUndefined();
    expect(hero.type === "hero" && hero.variant).toBe("collage");
  });
  it("رابط غير آمن", () => {
    expect("error" in applyHeroMedia(base(), { kind: "side_image", url: "http://x/y.jpg" }, origin)).toBe(true);
  });
});
