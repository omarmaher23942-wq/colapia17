import { describe, expect, it } from "vitest";
import { handoffUntil, isPauseChoice, pauseLabel, pauseState, pauseUntil } from "@/agent/pause";
import { agentConfigFrom, DEFAULT_AGENT_CONFIG, demoUrlFor } from "@/agent/config";
const NOW = Date.UTC(2026, 9, 17, 12, 0, 0);

describe("إيقاف الوكيل", () => {
  it("خيارات المدة ومواعيد انتهائها", () => {
    expect(isPauseChoice("3h")).toBe(true);
    expect(isPauseChoice("2h")).toBe(false);
    expect(pauseUntil("1h", NOW)!.getTime()).toBe(NOW + 3600_000);
    expect(pauseUntil("24h", NOW)!.getTime()).toBe(NOW + 24 * 3600_000);
    expect(pauseUntil("forever", NOW)).toBeNull();
    expect(handoffUntil(3, NOW).getTime()).toBe(NOW + 3 * 3600_000);
  });

  it("الحالة: يعمل، موقوف دائماً، موقوف مؤقتاً، انتهى", () => {
    expect(pauseState({ botPaused: false, botPausedUntil: null }, NOW)).toBe("active");
    expect(pauseState({ botPaused: true, botPausedUntil: null }, NOW)).toBe("paused");
    expect(pauseState({ botPaused: true, botPausedUntil: new Date(NOW + 60_000) }, NOW)).toBe("paused");
    expect(pauseState({ botPaused: true, botPausedUntil: new Date(NOW - 1) }, NOW)).toBe("expired");
    expect(pauseLabel({ botPaused: true, botPausedUntil: null }, NOW)).toContain("دائماً");
    expect(pauseLabel({ botPaused: true, botPausedUntil: new Date(NOW + 90 * 60_000) }, NOW)).toContain("ساعة");
    expect(pauseLabel({ botPaused: true, botPausedUntil: new Date(NOW + 20 * 60_000) }, NOW)).toContain("20 دقيقة");
  });
});

describe("إعداد الوكيل", () => {
  it("القيم الخاطئة ترجع للافتراضي والحدود مضبوطة", () => {
    expect(agentConfigFrom(null)).toEqual(DEFAULT_AGENT_CONFIG);
    expect(agentConfigFrom({ setupDelayMinutes: 0, setupDays: 1, dailyStoreCap: "abc", handoffPauseHours: 500, demoUrl: "http://x" })).toEqual({
      ...DEFAULT_AGENT_CONFIG,
      setupDelayMinutes: 0,
      setupDays: 2,
      handoffPauseHours: 72,
      demoUrl: "",
    });
    expect(agentConfigFrom({ demoUrl: "https://demo.example.com/" }).demoUrl).toBe("https://demo.example.com");
  });

  it("رابط الديمو الافتراضي من النطاق الرئيسي", () => {
    expect(demoUrlFor({ demoUrl: "" }, "colapia.com")).toBe("https://demo.colapia.com");
    expect(demoUrlFor({ demoUrl: "https://x.test" }, "colapia.com")).toBe("https://x.test");
  });
});

