import { describe, expect, it } from "vitest";
import { defaultBlueprint } from "@/blueprint/defaults";
import { blueprintSchema, type StoreBlueprint } from "@/blueprint/schema";
import { contrastRatio } from "@/blueprint/palette";
import { deriveCorePalette } from "@/blueprint/core-palette";
import {
  announcementState,
  applyDesignOps,
  applyHeroMedia,
  colorsIn,
  combineOps,
  describeColor,
  designResponseSchema,
  editableFields,
  mapForPrompt,
  parseRequest,
  planEdit,
  splitClauses,
  summarizeEdit,
  withAnnouncement,
} from "@/lib/design-tweak";
import { diffBlueprint } from "@/lib/blueprint-patch";
import { resolvePath, schemaHas } from "@/lib/design-edit/schema-map";

const light = () => blueprintSchema.parse(defaultBlueprint({ name: "متجر الاختبار", industry: "fashion" }));
/** متجر داكن (كحلي) كتصميم «منتصف الليل»: الخلفية والأزرار مختلفتان بوضوح. */
const dark = () => {
  const bp = light();
  bp.theme.mode = "dark";
  bp.theme.palette = deriveCorePalette("#7aa2ff", "dark");
  return bp;
};
const P = (bp: StoreBlueprint) => bp.theme.palette;

/** يطبّق الطلب بالفهم المباشر وحده (كما لو تعذّر الفهم الموسّع) ويعيد قبل/بعد. */
function run(text: string, base: StoreBlueprint = dark()) {
  const parsed = parseRequest(text, base);
  const r = applyDesignOps(base, parsed.ops);
  return { before: base, after: r.blueprint, parsed, r };
}
/** المسارات التي تغيّرت فعلاً بين النسختين (عمق 2 + ألوان اللوحة بالتفصيل). */
function changedPalette(a: StoreBlueprint, b: StoreBlueprint) {
  return (Object.keys(a.theme.palette) as (keyof StoreBlueprint["theme"]["palette"])[]).filter((k) => a.theme.palette[k] !== b.theme.palette[k]);
}

describe("الفهم المباشر: 30+ طلباً بالعربية والعامية والإنجليزية", () => {
  const bgWhite = (t: string) => () => {
    const { before, after } = run(t);
    expect(P(after).background).toBe("#ffffff");
    expect(P(after).primary).toBe(P(before).primary); // الأزرار لا تتغير أبداً مع الخلفية
    expect(P(after).accent).toBe(P(before).accent);
    expect(after.theme.mode).toBe("light");
    expect(contrastRatio(P(after).foreground, P(after).background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(P(after).mutedForeground, P(after).muted)).toBeGreaterThanOrEqual(4.5);
  };
  it("غير لون الخلفية للأبيض", bgWhite("غير لون الخلفية للأبيض"));
  it("خلفية بيضاء", bgWhite("خلفية بيضاء"));
  it("غيّروا خلفية الموقع إلى الأبيض", bgWhite("غيّروا خلفية الموقع إلى الأبيض"));
  it("change the background to white", bgWhite("change the background to white"));
  it("خلّي الخلفيه ابيض", bgWhite("خلّي الخلفيه ابيض"));

  const table: [string, (b: StoreBlueprint, a: StoreBlueprint) => void, (() => StoreBlueprint)?][] = [
    ["خلي الخلفيه كريمي", (b, a) => {
      expect(P(a).background).toBe("#f5efe0");
      expect(P(a).primary).toBe(P(b).primary);
    }],
    ["اجعلوا الأزرار خضراء", (b, a) => {
      expect(P(a).primary).toBe("#166534");
      expect(P(a).background).toBe(P(b).background);
      expect(contrastRatio(P(a).primaryForeground, P(a).primary)).toBeGreaterThanOrEqual(4.5);
      expect(changedPalette(b, a).every((k) => k === "primary" || k === "primaryForeground")).toBe(true);
    }],
    ["الأزرار سوداء ومدوّرة", (b, a) => {
      expect(P(a).primary).toBe("#111111");
      expect(a.design.shape.button).toBe(999);
      expect(P(a).background).toBe(P(b).background);
    }, light],
    ["خلفية الأزرار حمراء", (b, a) => {
      expect(P(a).primary).toBe("#dc2626");
      expect(P(a).background).toBe(P(b).background);
    }],
    ["لون الكلام أبيض", (b, a) => {
      expect(P(a).foreground).toBe("#ffffff");
      expect(P(a).background).toBe(P(b).background);
      expect(P(a).primary).toBe(P(b).primary);
    }],
    ["كبّروا الخط", (b, a) => {
      expect(a.theme.fonts.baseSize).toBe(b.theme.fonts.baseSize + 2);
      expect(a.design.type.headingScale).toBeGreaterThan(b.design.type.headingScale);
      expect(changedPalette(b, a)).toEqual([]);
    }],
    ["صغّر الخط شوية", (b, a) => expect(a.theme.fonts.baseSize).toBe(b.theme.fonts.baseSize - 1)],
    ["make the text bigger", (b, a) => expect(a.theme.fonts.baseSize).toBeGreaterThan(b.theme.fonts.baseSize)],
    ["العناوين أكبر", (b, a) => {
      expect(a.design.type.headingScale).toBeGreaterThan(b.design.type.headingScale);
      expect(a.theme.fonts.baseSize).toBe(b.theme.fonts.baseSize);
    }],
    ["الأزرار أكبر", (b, a) => {
      expect(a.design.button.size).toBe("lg");
      expect(P(a).primary).toBe(P(b).primary);
    }],
    ["اجعلوا الزوايا حادة", (_b, a) => {
      expect(a.theme.radius).toBe("none");
      expect(a.design.shape.card).toBe(0);
      expect(a.design.shape.button).toBe(0);
    }],
    ["زوايا دائرية بالكامل", (_b, a) => {
      expect(a.theme.radius).toBe("full");
      expect(a.design.shape.button).toBe(999);
    }],
    ["أزرار مفرغة", (b, a) => {
      expect(a.theme.buttonStyle).toBe("outline");
      expect(a.design.button.fill).toBe("outline");
      expect(P(a).primary).toBe(P(b).primary);
    }],
    ["مسافات أوسع بين العناصر", (_b, a) => expect(a.design.layout.density).toBe("airy")],
    ["الصفحة مزدحمة", (_b, a) => expect(a.design.layout.density).toBe("airy")],
    ["أخفوا الأسئلة الشائعة", (_b, a) => expect(a.home.find((s) => s.type === "faq")!.enabled).toBe(false)],
    ["شيل آراء العملاء", (_b, a) => expect(a.home.find((s) => s.type === "testimonials")!.enabled).toBe(false)],
    ["شريط الإعلان: شحن مجاني لكل المحافظات، والدفع عند الاستلام", (_b, a) => {
      expect(announcementState(a)).toEqual({ text: "شحن مجاني لكل المحافظات، والدفع عند الاستلام", enabled: true });
    }],
    ["غيروا العنوان الرئيسي إلى «أناقة كل يوم»", (_b, a) => {
      const hero = a.home.find((s) => s.type === "hero");
      expect(hero && hero.type === "hero" && hero.headline).toBe("أناقة كل يوم");
    }],
    ["خط أنيق", (_b, a) => {
      expect(a.theme.fonts.heading).toBe("el_messiri");
      expect(a.theme.fonts.body).toBe("tajawal");
    }],
    ["استخدموا خط تجوال للعناوين", (b, a) => {
      expect(a.theme.fonts.heading).toBe("tajawal");
      expect(a.theme.fonts.body).toBe(b.theme.fonts.body);
    }],
    ["dark mode", (b, a) => {
      expect(a.theme.mode).toBe("dark");
      expect(contrastRatio(P(a).background, "#000000")).toBeLessThan(contrastRatio(P(a).background, "#ffffff"));
      expect(P(a).primary).toBe(P(b).primary);
      expect(contrastRatio(P(a).foreground, P(a).background)).toBeGreaterThanOrEqual(4.5);
    }, light],
    ["خلوا المتجر في الوضع الفاتح", (_b, a) => {
      expect(a.theme.mode).toBe("light");
      expect(contrastRatio(P(a).background, "#000000")).toBeGreaterThan(contrastRatio(P(a).background, "#ffffff"));
    }],
    ["اجعلوا الخلفية بيضاء والأزرار سوداء", (_b, a) => {
      expect(P(a).background).toBe("#ffffff");
      expect(P(a).primary).toBe("#111111");
    }],
    ["الخلفية بيج والكلام بني غامق", (_b, a) => {
      expect(P(a).background).toBe("#e8dcc4");
      expect(describeColor(P(a).foreground)).toMatch(/البني|الأسود|الفحمي/);
      expect(contrastRatio(P(a).foreground, P(a).background)).toBeGreaterThanOrEqual(4.5);
    }],
    ["الهيدر شفاف", (_b, a) => expect(a.design.header.surface).toBe("transparent")],
    ["بدون حركات", (_b, a) => {
      expect(a.design.motion.level).toBe("calm");
      expect(a.design.motion.depth).toBe(false);
    }],
    ["الكروت بإطار", (_b, a) => expect(a.theme.productCardStyle).toBe("bordered")],
    ["خلفية متدرجة", (b, a) => {
      expect(a.design.surface.background).toBe("soft_gradient");
      expect(P(a).primary).toBe(P(b).primary);
    }],
    ["ظلال أقوى للبطاقات", (b, a) => expect(a.design.elevation.level).toBe(Math.min(4, b.design.elevation.level + 1))],
    ["اللون المميز ذهبي", (b, a) => {
      expect(P(a).accent).toBe("#d4a017");
      expect(P(a).primary).toBe(P(b).primary);
    }],
  ];
  for (const [text, check, base] of table) {
    it(text, () => {
      const b = (base ?? dark)();
      const { after, parsed, r } = run(text, b);
      expect(parsed.unresolved).toEqual([]);
      expect(r.changes.length).toBeGreaterThan(0);
      check(b, after);
      expect(blueprintSchema.safeParse(after).success).toBe(true);
    });
  }

  it("«غيّروا الأسود للأبيض» في متجر خلفيته سوداء ← الخلفية", () => {
    const b = light();
    b.theme.palette = { ...b.theme.palette, background: "#111111", foreground: "#f5f5f5", card: "#1a1a1a", cardForeground: "#f5f5f5", muted: "#222222", mutedForeground: "#bbbbbb", primary: "#d4a017" };
    const { after } = run("غيّروا الأسود للأبيض", b);
    expect(P(after).background).toBe("#ffffff");
    expect(P(after).primary).toBe("#d4a017");
  });
  it("تصميم كامل بالاسم", () => {
    const parsed = parseRequest("طبّقوا تصميم نيون", light());
    expect(parsed.ops).toEqual([{ path: "theme.preset", value: "neon-tech" }]);
  });
  it("طلب لا يفهمه المحلّل يبقى للفهم الموسّع", () => {
    const parsed = parseRequest("أريد إحساساً يشبه متاجر الساعات الفاخرة", light());
    expect(parsed.ops).toEqual([]);
    expect(parsed.unresolved).toHaveLength(1);
  });
  it("الجزء المفهوم يُنفّذ والباقي يُذكر", () => {
    const parsed = parseRequest("خلفية بيضاء، وأريد إحساساً فاخراً", dark());
    expect(parsed.ops.map((o) => o.path)).toEqual(["theme.palette.background"]);
    expect(parsed.unresolved).toHaveLength(1);
  });
});

describe("التحقق والتطبيق", () => {
  it("يرفض أي مسار خارج الخريطة ولا يغيّر شيئاً", () => {
    const bp = light();
    const r = applyDesignOps(bp, [
      { path: "customCss", value: "body{display:none}" },
      { path: "payments.cod.enabled", value: false },
      { path: "__proto__.polluted", value: "x" },
      { path: "home:nope.title", value: "x" },
      { path: "theme.palette.background.constructor", value: "#fff" },
    ]);
    expect(r.changes).toEqual([]);
    expect(r.rejected).toHaveLength(5);
    expect(diffBlueprint(bp as never, r.blueprint as never)).toEqual([]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it("الألوان: hex مختصر واسم عربي يُقبلان، والنص الخطر يُرفض", () => {
    const r = applyDesignOps(light(), [{ path: "theme.palette.accent", value: "#f80" }, { path: "theme.palette.primary", value: "red; background:url(x)" }]);
    expect(r.blueprint.theme.palette.accent).toBe("#ff8800");
    // «red» داخل النص اسم لون معروف: يُقبل بقيمته فقط ولا يمر أي CSS.
    expect(r.blueprint.theme.palette.primary).toBe("#dc2626");
    const bad = applyDesignOps(light(), [{ path: "theme.palette.primary", value: "url(x)" }]);
    expect(bad.rejected[0]).toContain("لون");
  });
  it("الأرقام تُحصر في حدودها والخيارات من القائمة فقط", () => {
    const r = applyDesignOps(light(), [{ path: "theme.fonts.baseSize", value: 40 }, { path: "theme.radius", value: "huge" }, { path: "design.layout.density", value: "واسعة" }]);
    expect(r.blueprint.theme.fonts.baseSize).toBe(20);
    expect(r.blueprint.design.layout.density).toBe("airy");
    expect(r.rejected.some((x) => x.includes("خيار"))).toBe(true);
  });
  it("النص يُقص بحده، والعنوان الرئيسي لا يكون فارغاً", () => {
    const r = applyDesignOps(light(), [{ path: "home:hero.headline", value: "أ".repeat(200) }]);
    const hero = r.blueprint.home.find((s) => s.type === "hero");
    expect(hero && hero.type === "hero" && hero.headline.length).toBe(90);
    const empty = applyDesignOps(light(), [{ path: "home:hero.headline", value: "" }]);
    expect(empty.changes).toEqual([]);
  });
  it("لون نص غير مقروء طلبه التاجر يُصلح ويُذكر", () => {
    const r = applyDesignOps(light(), [{ path: "theme.palette.foreground", value: "#fafafa" }]);
    expect(contrastRatio(P(r.blueprint).foreground, P(r.blueprint).background)).toBeGreaterThanOrEqual(4.5);
    expect(r.contrastFixes).toContain("لون النص");
    expect(summarizeEdit(r)).toContain("مقروءاً");
  });
  it("خلفية بلون الأزرار نفسه: لا تُغيَّر الأزرار، بل تنبيه لطيف", () => {
    const b = light();
    const r = applyDesignOps(b, [{ path: "theme.palette.background", value: b.theme.palette.primary }]);
    expect(P(r.blueprint).primary).toBe(b.theme.palette.primary);
    expect(r.warnings.join(" ")).toContain("الأزرار");
  });
  it("الوضع التلقائي يُثبَّت مع لون خلفية صريح ليظهر للجميع", () => {
    const b = light();
    expect(b.theme.mode).toBe("auto");
    const r = applyDesignOps(b, [{ path: "theme.palette.background", value: "#f5efe0" }]);
    expect(r.blueprint.theme.mode).toBe("light");
    expect(r.warnings.length).toBe(1);
  });
  it("قيمة مطابقة للحالية لا تُعد تغييراً", () => {
    const b = light();
    const r = applyDesignOps(b, [{ path: "theme.radius", value: b.theme.radius }]);
    expect(r.changes).toEqual([]);
    expect(r.unchanged).toHaveLength(1);
  });
  it("الواجهة لا تُخفى", () => {
    const r = applyDesignOps(light(), [{ path: "home:hero.enabled", value: false }]);
    expect(r.blueprint.home.find((s) => s.type === "hero")!.enabled).not.toBe(false);
    expect(r.rejected).toHaveLength(1);
  });
  it("ترتيب الأقسام بالمعرّفات يبقي الواجهة أولاً", () => {
    const r = applyDesignOps(light(), [{ path: "home.order", value: ["faq", "contact"] }]);
    expect(r.blueprint.home.map((s) => s.id).slice(0, 3)).toEqual(["hero", "faq", "contact"]);
    expect(r.blueprint.home).toHaveLength(light().home.length);
  });
  it("الناتج دائماً صالح ولا يلمس إلا أجزاء الشكل والمحتوى", () => {
    const bp = light();
    const r = applyDesignOps(bp, [
      { path: "theme.palette.primary", value: "#16a34a" },
      { path: "theme.fonts.baseSize", value: 18 },
      { path: "home:hero.headline", value: "عنوان جديد" },
      { path: "announcement.text", value: "إعلان" },
      { path: "brand.tagline", value: "سطر جديد" },
      { path: "seo.title", value: "عنوان البحث" },
      { path: "copy.addToCart", value: "إضافة للسلة" },
    ]);
    expect(blueprintSchema.safeParse(r.blueprint).success).toBe(true);
    const tops = new Set(diffBlueprint(bp as never, r.blueprint as never).map((c) => c.path[0]));
    for (const t of tops) expect(["theme", "design", "home", "header", "brand", "seo", "copy"]).toContain(t);
    expect(r.changes).toHaveLength(7);
  });
  it("مخطط رد النموذج يحد عدد العمليات", () => {
    expect(designResponseSchema.safeParse({ ops: [{ path: "x", value: "y" }] }).success).toBe(true);
    expect(designResponseSchema.safeParse({ ops: Array.from({ length: 40 }, () => ({ path: "x", value: 1 })) }).success).toBe(false);
  });
});

describe("خريطة التعديل", () => {
  it("تغطي الشكل والمحتوى وكل حقل له اسم عربي", () => {
    const f = editableFields(light());
    const paths = new Set(f.map((x) => x.path));
    for (const p of ["theme.palette.background", "theme.palette.primary", "theme.fonts.heading", "theme.radius", "design.card.hover", "design.button.fill", "design.header.surface", "brand.name", "home:hero.headline", "home:faq.items.0.q", "announcement.text", "home.order", "theme.preset", "seo.description", "copy.addToCart", "footer.tagline"]) expect(paths.has(p), p).toBe(true);
    for (const x of f) expect(x.label.length, x.path).toBeGreaterThan(1);
    // لا روابط ولا صور ولا ادعاءات حقيقية (آراء العملاء) ولا إعدادات دفع.
    expect([...paths].some((p) => /payments|shipping\.|videoUrl|images|customCss|reviews\.items/.test(p))).toBe(false);
  });
  it("تكتشف حقول المخطط الاختيارية الجديدة إن وُجدت", () => {
    expect(schemaHas("theme.palette.background")).toBe(true);
    expect(schemaHas("theme.notAField")).toBe(false);
  });
  it("المسارات: أقسام بالمعرّف وحماية من المفاتيح الخطرة", () => {
    const bp = light();
    expect(resolvePath(bp, "home:faq.title")).toEqual(["home", bp.home.findIndex((s) => s.id === "faq"), "title"]);
    expect(resolvePath(bp, "theme.__proto__")).toBeNull();
  });
  it("الخريطة نصاً للبرومبت", () => {
    const m = mapForPrompt(editableFields(light()));
    expect(m).toContain("theme.palette.background | لون خلفية المتجر | لون #rrggbb | \"#ffffff\"");
  });
});

describe("الألوان والجمل", () => {
  it("أسماء الألوان بالبادئات والعامية", () => {
    expect(colorsIn("للأبيض")[0]!.hex).toBe("#ffffff");
    expect(colorsIn("بالكحلي")[0]!.hex).toBe("#1e293b");
    expect(colorsIn("لبني")[0]!.name).toBe("السماوي");
    expect(colorsIn("أزرق فاتح")[0]!.name).toBe("الأزرق الفاتح");
    expect(colorsIn("نبيتي")[0]!.hex).toBe("#7a1f3d");
    expect(colorsIn("#ABC")[0]!.hex).toBe("#aabbcc");
  });
  it("تقسيم الطلب إلى جمل", () => {
    expect(splitClauses("اجعلوا الخلفية بيضاء والأزرار سوداء")).toHaveLength(2);
    expect(splitClauses("تصميم أسود وذهبي")).toHaveLength(1);
    expect(splitClauses("خلفية وردي")).toHaveLength(1);
  });
  it("وصف الألوان", () => {
    expect(describeColor("#fefefe")).toBe("الأبيض");
    expect(describeColor("#0a0a0a")).toBe("الأسود");
  });
});

describe("الخطة: الدمج والمعاينة والملخص", () => {
  it("المباشر أولاً، والموسّع لمسارات أخرى فقط", () => {
    const ops = combineOps([{ path: "theme.palette.background", value: "#ffffff" }], [{ path: "theme.palette.background", value: "#000000" }, { path: "design.layout.density", value: "airy" }]);
    expect(ops).toEqual([{ path: "theme.palette.background", value: "#ffffff" }, { path: "design.layout.density", value: "airy" }]);
  });
  it("معاينة قبل/بعد وملخص عربي بلا ذكر للتقنية", () => {
    const bp = dark();
    const plan = planEdit(bp, parseRequest("خلفية بيضاء وكبّروا الخط", bp));
    expect(plan.before.background).not.toBe(plan.after.background);
    expect(plan.after.background).toBe("#ffffff");
    expect(plan.summary).toContain("غيّرنا لون خلفية المتجر إلى الأبيض");
    expect(plan.summary).toContain("كبّرنا حجم الخط الأساسي");
    expect(plan.summary).not.toMatch(/ذكاء|AI|نموذج/);
  });
  it("الموسّع يكمل ما لم يُفهم مباشرة", () => {
    const bp = light();
    const parsed = parseRequest("أريد إحساساً فاخراً", bp);
    const plan = planEdit(bp, parsed, { ops: [{ path: "theme.fonts.heading", value: "el_messiri" }, { path: "payments.cod.enabled", value: false }] });
    expect(plan.blueprint.theme.fonts.heading).toBe("el_messiri");
    expect(plan.unresolved).toEqual([]);
    expect(plan.rejected).toHaveLength(1);
  });
  it("تعذر الموسّع: رسالة صادقة ولا تغيير", () => {
    const bp = light();
    const plan = planEdit(bp, parseRequest("أريد إحساساً فاخراً", bp), null, true);
    expect(plan.ops).toEqual([]);
    expect(plan.summary).toContain("تعذر");
  });
});

describe("شريط الإعلان: القراءة والكتابة من المصدر الذي يعرضه المتجر", () => {
  it("يكتب في شريط الهيدر ويطفئ القسم القديم", () => {
    const bp = light();
    bp.home.unshift({ id: "announcement-1", type: "announcement", enabled: true, spacing: "normal", background: "primary", reveal: "none", variant: "static", messages: [{ text: "قديم" }], dismissible: true, sticky: true });
    const next = withAnnouncement(bp, "جديد", true);
    expect(announcementState(next)).toEqual({ text: "جديد", enabled: true });
    expect(next.home.find((s) => s.type === "announcement")!.enabled).toBe(false);
    expect(announcementState(withAnnouncement(next, "جديد", false)).enabled).toBe(false);
  });
});

describe("وسائط الواجهة", () => {
  const origin = "https://colapia.com";
  it("فيديو جاهز يضبط الفيديو والغلاف والتخطيط", () => {
    const r = applyHeroMedia(light(), { kind: "video_fashion" }, origin);
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    const hero = r.blueprint.home.find((s) => s.type === "hero")!;
    expect(hero.type === "hero" && hero.videoUrl).toBe("https://colapia.com/demo/media/hero-fashion.mp4");
    expect(hero.type === "hero" && hero.images[0]!.url).toBe("https://colapia.com/demo/media/hero-fashion.jpg");
    expect(blueprintSchema.safeParse(r.blueprint).success).toBe(true);
  });
  it("فيديو مرفوع بلا غلاف يُرفض بلطف", () => {
    const bp = light();
    const hero = bp.home.find((s) => s.type === "hero");
    if (hero && hero.type === "hero") hero.images = [];
    expect("error" in applyHeroMedia(bp, { kind: "video_upload", url: "https://m.example.com/v.mp4" }, origin)).toBe(true);
  });
  it("تلقائي يزيل الفيديو ويستخدم صور المنتجات", () => {
    const r = applyHeroMedia(light(), { kind: "auto" }, origin, [1, 2, 3, 4].map((i) => ({ url: `https://m.example.com/${i}.jpg`, alt: `م${i}` })));
    if ("error" in r) throw new Error(r.error);
    const hero = r.blueprint.home.find((s) => s.type === "hero")!;
    expect(hero.type === "hero" && hero.videoUrl).toBeUndefined();
    expect(hero.type === "hero" && hero.variant).toBe("collage");
  });
  it("رابط غير آمن", () => {
    expect("error" in applyHeroMedia(light(), { kind: "side_image", url: "http://x/y.jpg" }, origin)).toBe(true);
  });
});
