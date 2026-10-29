// الرد الآلي على كلمات الدعوة في المنشورات: مطابقة متسامحة للكلمات المعتمدة، ورفض الرسائل الطويلة والشكاوى، ونصوص صادقة.
import { describe, expect, it } from "vitest";
import { matchAdOpening, matchKeyword, normalize, replyFor } from "@/agent/keyword-reply";
import { offerFrom } from "@/agent/offer";

const open = offerFrom({ available: true, seatsLeft: 4, seats: 5, buildPrice: 999, regularBuildPrice: 2499 });
const closed = offerFrom({ available: false, seatsLeft: 0, seats: 5, buildPrice: 999 });
const ctx = (offer = open) => ({ offer, demoUrl: "https://demo.colapia.com", qimaUrl: "https://qima-ten.vercel.app" });

describe("matchKeyword", () => {
  it.each([
    ["متجر", "store"],
    ["«متجر»", "store"],
    ["المتجر", "store"],
    ["متجــر", "store"],
    ["متجَر", "store"],
    ["متاجر", "store"],
    ["متحر", "store"], // خطأ إملائي بحرف
    ["Store", "store"],
    ["matgar", "store"],
    ["عايز متجر", "store"],
    ["ممكن تفاصيل المتجر لو سمحت", "store"],
    ["مشروع", "project"],
    ["مشروعي", "project"],
    ["مشرووع", "project"],
    ["Project", "project"],
    ["تفاصيل", "offer"],
    ["التفاصيل", "offer"],
    ["تفاصيل؟", "offer"],
    ["تفاصيييل", null], // مبالغة حروف: لا مطابقة (يقرأها الفريق)
    ["تفصيل", "offer"],
    ["عرض", "offer"],
    ["بكام", "offer"],
    ["details", "offer"],
    ["السلام عليكم تفاصيل", "offer"],
  ])("«%s» → %s", (text, rule) => {
    expect(matchKeyword(text)).toBe(rule);
  });

  it("يرفض الرسائل الطويلة والشكاوى والكلام العادي", () => {
    expect(matchKeyword("المتجر اللي عملتوه لنا مش شغال من امبارح")).toBeNull();
    expect(matchKeyword("عندي متجر على فيسبوك وعايز أنقله لكم وأعرف تكلفة الدومين والاستضافة بالتفصيل")).toBeNull();
    expect(matchKeyword("مرحبا")).toBeNull();
    expect(matchKeyword("")).toBeNull();
    expect(matchKeyword(null)).toBeNull();
    expect(matchKeyword("😀")).toBeNull();
    expect(matchKeyword("ازاي اطلب")).toBeNull();
  });

  it("متجر أولى من تفاصيل عند اجتماعهما", () => {
    expect(matchKeyword("تفاصيل متجر")).toBe("store");
  });
});

describe("منشورات نُشرت وإعلانات الرسائل", () => {
  it("«فكرتكم» و«رسالة» (عبارتا منشورين منشورين) تُرد عليهما بتفاصيل أي مشروع", () => {
    expect(matchKeyword("عندي فكرة")).toBe("project");
    expect(matchKeyword("رسالة")).toBe("project");
  });
  it("رسالة إعلان جاهزة تُرد بتفاصيل المتجر، والشكوى والطويل لا", () => {
    expect(matchAdOpening("أريد معرفة المزيد")).toBe("store");
    expect(matchAdOpening("Hi! Can I get more info?", "project")).toBe("project");
    expect(matchAdOpening("الاعلان ده نصب ولا ايه")).toBeNull();
    expect(matchAdOpening("x".repeat(200))).toBeNull();
    expect(matchAdOpening("")).toBeNull();
  });
});

describe("normalize", () => {
  it("يوحّد الهمزات والياء والتاء المربوطة ويزيل التشكيل", () => {
    expect(normalize("إِنْشَاءُ المُتْجَرِ؟")).toBe("انشاء المتجر");
    expect(normalize("تكلفة")).toBe("تكلفه");
    expect(normalize("على")).toBe("علي");
  });
});

describe("replyFor", () => {
  it("كل رد يعد بمتابعة الفريق ويطلب الاسم والواتساب ولا يتجاوز حد الرسالة ولا يدّعي بشراً", () => {
    for (const rule of ["store", "project", "offer"] as const) {
      for (const o of [open, closed]) {
        const t = replyFor(rule, ctx(o));
        expect(t).toMatch(/فريقنا سيطّلع على رسالتكم ويرد عليكم في أقرب وقت/);
        expect(t).toMatch(/واتساب/);
        expect(t.length).toBeLessThan(1500);
        expect(t).not.toMatch(/أنا إنسان|مجاني|مجانا|Groq|Vercel|الذكاء الاصطناعي/);
      }
    }
  });

  it("سطر العرض حقيقي: السعر والمقاعد من النظام، ويختفي عند اكتمال المقاعد", () => {
    const withOffer = replyFor("store", ctx(open));
    expect(withOffer).toContain("999");
    expect(withOffer).toContain("المتبقي الآن 4 من 5");
    const without = replyFor("store", ctx(closed));
    expect(without).not.toContain("999");
    expect(replyFor("offer", ctx(closed))).toContain("اكتملت أماكن عرض الإطلاق");
  });

  it("يحمل رابط الديمو وQima", () => {
    const t = replyFor("project", ctx());
    expect(t).toContain("https://demo.colapia.com");
    expect(t).toContain("https://qima-ten.vercel.app");
  });
});
