import { describe, expect, it } from "vitest";
import { DEFAULT_GOLDEN, DEFAULT_PRICING } from "@/lib/platform-pricing";
import { detectMentions, goldenLine, monthlyHint, plansLine, renewalLine } from "@/agent/offers";
import { stateBlock } from "@/agent/state";

describe("أسطر العروض من الأسعار الحقيقية", () => {
  it("التجهيز والباقات والتجديد", () => {
    expect(plansLine(DEFAULT_PRICING)).toBe("التجهيز 2,999 ج مرة واحدة، والاستضافة: الأساسية 199 ج شهرياً، النمو 499 ج شهرياً، الاحترافية 1,499 ج شهرياً");
    expect(renewalLine(DEFAULT_PRICING)).toContain("بلا رسوم تجهيز");
    expect(monthlyHint(DEFAULT_PRICING)).toContain("199");
  });

  it("سطر الدائرة الذهبية فارغ إن توقف العرض أو اكتملت المقاعد", () => {
    expect(goldenLine({ ...DEFAULT_GOLDEN, enabled: false }, 5)).toBe("");
    expect(goldenLine(DEFAULT_GOLDEN, 0)).toBe("");
    const line = goldenLine(DEFAULT_GOLDEN, 3, 2999);
    expect(line).toContain("999");
    expect(line).toContain("بدلاً من 2,999");
    expect(line).toContain("3 مقاعد");
    expect(goldenLine(DEFAULT_GOLDEN, 1)).toContain("مقعد فقط");
  });

  it("رصد ما ذكره الوكيل من ديمو وعرض ذهبي", () => {
    expect(detectMentions(["جربوا demo.colapia.com"], { demoHost: "demo.colapia.com", goldenPrice: 999 })).toEqual({ demo: true, golden: false });
    expect(detectMentions(["عندنا الدائرة الذهبية"], { demoHost: "demo.colapia.com", goldenPrice: 999 })).toEqual({ demo: false, golden: true });
    expect(detectMentions([], { demoHost: "d.co", goldenPrice: 999 })).toEqual({ demo: false, golden: false });
  });
});

describe("كتلة حالة المحادثة", () => {
  const base = { replies: 0, channel: "instagram" as const, lead: {}, invalid: {}, mentions: { demo: false, golden: false }, storeExists: false, imagesReceived: 0, summary: "", goldenAvailable: true };

  it("تسرد المجموع والناقص بالترتيب وتطلب الأول فقط", () => {
    const s = stateBlock({ ...base, lead: { storeName: "نور" }, replies: 2 });
    expect(s).toContain("اسم المتجر: نور");
    expect(s.indexOf("نشاطه")).toBeLessThan(s.indexOf("بريد Google"));
    expect(s).toContain("الأول فقط");
    expect(s).toContain("لا ترحب");
  });

  it("تذكر القيم غير الصالحة وتطلب تصحيحها", () => {
    const s = stateBlock({ ...base, invalid: { email: "abc" } });
    expect(s).toContain("«abc» غير صالح");
  });

  it("عند الاكتمال تطلب موافقة صريحة، وبعد الإنشاء تمنع الجمع", () => {
    const lead = { niche: "ملابس", storeName: "نور", email: "a@b.co", whatsapp: "01012345678" };
    expect(stateBlock({ ...base, lead })).toContain("confirmCreate = true");
    const created = stateBlock({ ...base, lead, storeExists: true });
    expect(created).toContain("أُنشئ بالفعل");
    expect(created).not.toContain("confirmCreate = true");
  });

  it("تخبر بما ذُكر من الديمو والذهبية، وتمنع الذهبية إن لم تتح", () => {
    expect(stateBlock({ ...base, mentions: { demo: true, golden: true } })).toContain("ذُكر سابقاً");
    expect(stateBlock({ ...base, goldenAvailable: false })).toContain("غير متاح الآن");
    expect(stateBlock({ ...base, imagesReceived: 3 })).toContain("3 صورة");
  });

  it("إنستجرام المعروف لا يُسأل عنه", () => {
    expect(stateBlock({ ...base, lead: { instagram: "nour" } })).toContain("@nour");
  });
});
