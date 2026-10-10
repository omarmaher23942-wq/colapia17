import { describe, expect, it } from "vitest";
import { DISCLOSURE, needsDisclosure, wantsHuman, withDisclosure } from "@/ai/agents/closer/policy";
import { HUMAN_AGENT_WINDOW_MS, replyMode, STANDARD_WINDOW_MS } from "@/channels/meta";

const H = 36e5;
const now = Date.now();

describe("إفصاح الوكيل أنه آلي", () => {
  it("أول رد في المحادثة: يُفصح", () => {
    expect(needsDisclosure({ lastBotMessageAt: null, hasAnyBotMessage: false }, now)).toBe(true);
  });
  it("وسط الحوار (آخر رد قبل ساعة): لا يكرر", () => {
    expect(needsDisclosure({ lastBotMessageAt: new Date(now - H), hasAnyBotMessage: true }, now)).toBe(false);
  });
  it("بعد انقطاع أكثر من 24 ساعة أو بعد عودته من موظف: يُفصح من جديد", () => {
    expect(needsDisclosure({ lastBotMessageAt: new Date(now - 25 * H), hasAnyBotMessage: true }, now)).toBe(true);
    expect(needsDisclosure({ lastBotMessageAt: new Date(now - H), hasAnyBotMessage: true, resumedFromHuman: true }, now)).toBe(true);
  });
  it("الإفصاح في أول الرد", () => {
    expect(withDisclosure("أهلاً", true).startsWith(DISCLOSURE)).toBe(true);
    expect(withDisclosure("أهلاً", false)).toBe("أهلاً");
  });
});

describe("طلب موظف بشري", () => {
  it.each(["عايز اكلم موظف", "ممكن حد حقيقي يرد", "خدمة العملاء", "human please", "كلمني حد"])("%s", (t) => {
    expect(wantsHuman(t)).toBe(true);
  });
  it.each(["بكام المتجر", "عندي محل ملابس", "ابعت الرابط"])("%s لا يطلب موظفاً", (t) => {
    expect(wantsHuman(t)).toBe(false);
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
