import { describe, expect, it } from "vitest";
import { BUSINESS_TYPES, FEATURES, PALETTES, STEPS, cleanDomain, featuresFor, normalizeContactPhone, parseBrief, recommendFeatures, stepErrors, suggestedLanguage, waMe, type BriefDraft } from "@/briefs/realestate";
import { clientWhatsappMessage, renderBriefMarkdown, renderBuildPrompt } from "@/briefs/render";

const valid = (over: BriefDraft = {}): BriefDraft => ({
  businessName: "الريادة العقارية", businessType: "agency", teamSize: "small",
  propertyTypes: ["residential"], dealTypes: ["resale"], scale: "m",
  areas: ["new_cairo"], audience: ["local"], languages: "ar", goals: ["leads"],
  features: ["crm"], logoMode: "design", logoStyle: "symbol", palette: "royal", style: "luxury",
  contactName: "أحمد", whatsapp: "010 1234 5678", domain: "need", media: "some", timeline: "asap", ...over,
});

describe("الاستمارة العقارية", () => {
  it("استمارة مكتملة تُقبل وتُنظَّف", () => {
    const r = parseBrief(valid({ email: "A@B.com", services: ["finishing"] }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.whatsapp).toBe("01012345678");
      expect(r.data.email).toBe("a@b.com");
      expect(r.data.services).toEqual([]); // ليست مقاولات
    }
  });
  it("تعيد أول خطوة ناقصة", () => {
    const r = parseBrief(valid({ goals: [] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(STEPS[r.step]!.id).toBe("goals");
  });
  it("المقاول يُسأل عن الخدمات لا المعاملات", () => {
    expect(stepErrors("properties", valid({ businessType: "construction", dealTypes: [] })).services).toBeTruthy();
    expect(parseBrief(valid({ businessType: "construction", dealTypes: [], services: ["finishing"] })).ok).toBe(true);
  });
  it("ثلاثة أهداف كحد أقصى", () => {
    expect(stepErrors("goals", valid({ goals: ["leads", "brand", "crm", "time"] })).goals).toBeTruthy();
  });
  it("ألوان مخصصة تتطلب لونين صالحين", () => {
    expect(stepErrors("look", valid({ palette: "custom" })).primaryColor).toBeTruthy();
    expect(parseBrief(valid({ palette: "custom", primaryColor: "#112233", accentColor: "#AABBCC" })).ok).toBe(true);
  });
  it("الشعار: المرفوع يحتاج رابطاً، والتصميم يحتاج شكلاً، و«لاحقاً» يمر", () => {
    expect(stepErrors("look", valid({ logoMode: "have" })).logoUrl).toBeTruthy();
    expect(stepErrors("look", valid({ logoMode: "have", logoUrl: "http://x.com/a.png" })).logoUrl).toBeTruthy();
    expect(stepErrors("look", valid({ logoMode: "have", logoUrl: "https://media.colapia.com/briefs/logos/a.png" })).logoUrl).toBeUndefined();
    expect(stepErrors("look", valid({ logoMode: "design", logoStyle: "" })).logoStyle).toBeTruthy();
    expect(stepErrors("look", valid({ logoMode: "later" }))).toEqual({});
    expect(stepErrors("look", valid({ logoMode: undefined })).logoMode).toBeTruthy();
  });
  it("الشعار يُنظَّف حسب الوضع ويأخذ اسم النشاط افتراضياً", () => {
    const d = parseBrief(valid({ logoMode: "design", logoStyle: "monogram", logoIdeas: ["key"], logoUrl: "https://media.colapia.com/x.png" }));
    expect(d.ok && d.data.logoUrl).toBe("");
    expect(d.ok && d.data.logoName).toBe("الريادة العقارية");
    const h = parseBrief(valid({ logoMode: "have", logoUrl: "https://media.colapia.com/briefs/logos/a.png", logoStyle: "symbol", logoNotes: "x" }));
    expect(h.ok && h.data.logoStyle).toBe("");
    expect(h.ok && h.data.logoNotes).toBe("");
  });
  it("الألوان اليدوية: تكفي الكتابة بدل المنتقي", () => {
    expect(stepErrors("look", valid({ palette: "custom", colorsNote: "كحلي وذهبي" })).primaryColor).toBeUndefined();
    expect(stepErrors("look", valid({ palette: "custom", primaryColor: "#112233" })).primaryColor).toBeTruthy();
    const r = parseBrief(valid({ palette: "royal", colorsNote: "تجاهلوها" }));
    expect(r.ok && r.data.colorsNote).toBe("");
  });
  it("البريف وبرومبت البناء يصفان الشعار", () => {
    const meta = { id: "x", ref: "RE-1", createdAt: new Date() };
    const a = parseBrief(valid({ logoMode: "have", logoUrl: "https://media.colapia.com/briefs/logos/a.png" }));
    const b = parseBrief(valid({ logoMode: "design", logoStyle: "wordmark", logoIdeas: ["home"], palette: "custom", colorsNote: "أخضر زيتي" }));
    if (!a.ok || !b.ok) throw new Error("invalid");
    expect(renderBriefMarkdown(a.data, meta)).toContain("https://media.colapia.com/briefs/logos/a.png");
    expect(renderBuildPrompt(a.data, meta)).toContain("العميل رفع شعاره");
    expect(renderBriefMarkdown(b.data, meta)).toContain("يطلب تصميم شعار");
    expect(renderBriefMarkdown(b.data, meta)).toContain("أخضر زيتي");
    expect(renderBuildPrompt(b.data, meta)).toContain("SVG");
  });
  it("أرقام واتساب مصرية ودولية", () => {
    expect(normalizeContactPhone("+20 101 234 5678")).toBe("01012345678");
    expect(normalizeContactPhone("+971 50 123 4567")).toBe("+971501234567");
    expect(normalizeContactPhone("12345")).toBeNull();
    expect(waMe("+971501234567")).toBe("https://wa.me/971501234567");
    expect(waMe("01012345678")).toBe("https://wa.me/201012345678");
  });
  it("النطاق يُنظَّف", () => {
    expect(cleanDomain("https://www.Example.com/x")).toBe("example.com");
    expect(cleanDomain("not a domain")).toBe("");
  });
  it("المميزات الموصى بها تناسب النشاط", () => {
    expect(recommendFeatures({ businessType: "shortstay" })).toContain("availability");
    expect(recommendFeatures({ businessType: "construction" })).not.toContain("availability");
    expect(recommendFeatures({ businessType: "developer", goals: ["launch"] })).toContain("inventory");
    expect(recommendFeatures({ businessType: "broker", audience: ["gulf"] })).toContain("currency");
    expect(featuresFor("construction").some((f) => f.id === "availability")).toBe(false);
    expect(suggestedLanguage(["expats"])).toBe("ar_en");
  });
  it("معرّفات الخيارات فريدة", () => {
    for (const list of [BUSINESS_TYPES, FEATURES, PALETTES]) expect(new Set(list.map((o) => o.id)).size).toBe(list.length);
  });
  it("البريف والبرومبت يحملان الإجابات والتعليمات الثابتة", () => {
    const r = parseBrief(valid({ problem: "ضياع العملاء", languages: "ar_en" }));
    if (!r.ok) throw new Error("invalid");
    const meta = { id: "x", ref: "RE-TEST1", createdAt: new Date("2026-10-31T10:00:00Z") };
    const md = renderBriefMarkdown(r.data, meta);
    expect(md).toContain("الريادة العقارية");
    expect(md).toContain("ضياع العملاء");
    expect(md).toContain("RE-TEST1");
    const prompt = renderBuildPrompt(r.data, meta);
    expect(prompt).toContain("CLIENT_DATABASE_URL");
    expect(prompt).toContain("الإعداد الأول");
    expect(prompt).toContain("hreflang");
    expect(clientWhatsappMessage(r.data, "RE-TEST1")).toContain("48 ساعة");
  });
});
