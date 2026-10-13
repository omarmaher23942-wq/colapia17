import { describe, expect, it } from "vitest";
import { ASK_BOT_REPLY, HANDOFF_REPLY, RATE_NOTICE, asksIfBot, wantsHuman } from "@/ai/agents/closer/policy";
import { HUMAN_AGENT_WINDOW_MS, replyMode, STANDARD_WINDOW_MS } from "@/channels/meta";

const H = 36e5;
const now = Date.now();

describe("سؤال «انت بوت ولا إنسان؟»", () => {
  it.each([
    "انت بوت ولا انسان؟",
    "انت بوت ولا بني ادم",
    "ده بوت ولا حد حقيقي",
    "هل انت روبوت",
    "are you a bot?",
    "bot or human",
    "حضرتك انسان ولا بوت",
    "الرد ده اوتوماتيك؟ ولا شخص",
    "انتو بوت؟",
    "هو بوت ده ولا ايه",
    "الرد ده اوتوماتيك؟",
    "ده رد الي؟",
    "هل انت انسان",
    "انت موظف ولا بوت",
    "انتم بوتات؟",
    "هل حضرتك ذكاء اصطناعي",
  ])("%s", (t) => {
    expect(asksIfBot(t)).toBe(true);
  });
  it.each([
    "بكام المتجر",
    "عندي محل ملابس",
    "ابعت الرابط",
    "عايز اكلم موظف",
    "هاي",
    "ممكن تفاصيل",
    // كلمات تحوي «بوت» أو «ai» أو «اوتوماتيك» لكنها ليست سؤالاً عن المحادثة:
    "عندي بوتيك ولا لا",
    "بوتيك ملابس حريمي او رجالي",
    "ابعتلي email ولا واتساب",
    "الدفع اوتوماتيك ولا يدوي",
    "عندكم بوت للمتجر",
    "هل عندكم برنامج للمحاسبة",
    "شركة ai للتسويق",
    "هل available",
  ])("%s ليس سؤالاً عن البوت", (t) => {
    expect(asksIfBot(t)).toBe(false);
  });
  it("الرد الصادق قصير ويقول «أنا بوت» دون تعريف مطوّل", () => {
    expect(ASK_BOT_REPLY).toContain("أنا بوت");
    expect(ASK_BOT_REPLY.length).toBeLessThan(120);
  });
});

describe("طلب موظف بشري", () => {
  it.each(["عايز اكلم موظف", "ممكن حد حقيقي يرد", "خدمة العملاء", "human please", "كلمني حد"])("%s", (t) => {
    expect(wantsHuman(t)).toBe(true);
  });
  it.each(["بكام المتجر", "عندي محل ملابس", "ابعت الرابط"])("%s لا يطلب موظفاً", (t) => {
    expect(wantsHuman(t)).toBe(false);
  });
  it("«انت بوت ولا انسان» سؤال يُجاب بصدق لا طلب تحويل", () => {
    expect(wantsHuman("انت بوت ولا انسان؟")).toBe(false);
    expect(wantsHuman("ده بوت ولا حد حقيقي")).toBe(false);
  });
});

describe("ردود الوكيل الثابتة لا تخاطب جنساً واحداً", () => {
  it.each([
    ["ASK_BOT_REPLY", ASK_BOT_REPLY],
    ["HANDOFF_REPLY", HANDOFF_REPLY],
    ["RATE_NOTICE", RATE_NOTICE],
  ])("%s", (_name, text) => {
    for (const w of ["اكتب ", "تقدر", "معاك", "عايز", "متأكد"]) expect(text).not.toContain(w);
  });
});

describe("نافذة الرد (Meta)", () => {
  it("داخل 24 ساعة: رد عادي", () => {
    expect(replyMode(new Date(now - 2 * H), now).mode).toBe("standard");
  });
  it("بين 24 ساعة و7 أيام: رد بشري بوسم HUMAN_AGENT فقط", () => {
    expect(replyMode(new Date(now - 30 * H), now).mode).toBe("human_agent");
    expect(replyMode(new Date(now - (HUMAN_AGENT_WINDOW_MS - H)), now).mode).toBe("human_agent");
  });
  it("بعد 7 أيام أو بلا رسالة سابقة: مغلق", () => {
    expect(replyMode(new Date(now - HUMAN_AGENT_WINDOW_MS - H), now).mode).toBe("closed");
    expect(replyMode(null, now).mode).toBe("closed");
    expect(STANDARD_WINDOW_MS).toBeLessThan(24 * H);
  });
});
