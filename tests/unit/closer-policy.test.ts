import { describe, expect, it } from "vitest";
import { HUMAN_AGENT_WINDOW_MS, replyMode, STANDARD_WINDOW_MS } from "@/channels/meta";

const H = 36e5;
const now = Date.now();

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
