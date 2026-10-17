import { describe, expect, it } from "vitest";
import { handoffUntil, isPauseChoice, pauseLabel, pauseState, pauseUntil } from "@/agent/pause";
import { setupLinkMessage, setupReminderMessage, setupSchedule } from "@/agent/setup-messages";
import { agentConfigFrom, DEFAULT_AGENT_CONFIG, demoUrlFor } from "@/agent/config";
import { suggestSlug } from "@/agency/slug";

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

describe("رابط الإعداد وتذكيراته", () => {
  it("الرسائل بالجمع وبلا ذكر لتقنيات", () => {
    const m = setupLinkMessage({ storeName: "نور" });
    expect(m.text).toContain("«نور»");
    expect(m.text).toContain("Google");
    expect(m.buttonTitle).toBe("إعداد المتجر");
    const r = setupReminderMessage("72h", { storeName: "نور" });
    expect(r.text).toContain("نحذف");
    expect(setupReminderMessage("24h", { storeName: "نور" }).subject).toContain("نور");
  });

  it("المواعيد: الرابط بعد المهلة، والتذكيران بعده، والحذف بعد الأيام", () => {
    const now = new Date(NOW);
    const t = setupSchedule(now, { delayMinutes: 30, setupDays: 14 });
    expect(t.link.getTime()).toBe(NOW + 30 * 60_000);
    expect(t.reminder24.getTime()).toBe(t.link.getTime() + 24 * 3600_000);
    expect(t.reminder72.getTime()).toBe(t.link.getTime() + 72 * 3600_000);
    expect(t.purge.getTime()).toBe(NOW + 14 * 86_400_000);
    // مهلة إعداد قصيرة: التذكيران يسبقان الحذف بنصف يوم على الأقل.
    const short = setupSchedule(now, { delayMinutes: 0, setupDays: 2 });
    expect(short.reminder72.getTime()).toBeLessThanOrEqual(short.purge.getTime() - 12 * 3600_000);
    expect(short.reminder24.getTime()).toBeGreaterThan(short.link.getTime());
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

describe("اختيار النطاق الفرعي", () => {
  it("حساب إنستجرام أولاً ثم الاسم، والمأخوذ يتبدل", () => {
    expect(suggestSlug({ storeName: "نور للملابس", socialUrl: "https://www.instagram.com/nour_wear/", code: "123456" })).toBe("nour-wear");
    expect(suggestSlug({ storeName: "Nour Store", socialUrl: null, code: "123456" })).toBe("nour-store");
    const taken = new Set(["nour-wear", "nour-wear-2"]);
    expect(suggestSlug({ storeName: "x", socialUrl: "https://www.instagram.com/nour_wear/", code: "123456" }, (s) => taken.has(s))).toBe("nour-wear-3");
  });

  it("اسم عربي يُنقحر، وغير الصالح يرجع لرمز المحادثة، والمحجوز لا يُستخدم", () => {
    expect(suggestSlug({ storeName: "متجر الأناقة", socialUrl: null, code: "123456" })).toMatch(/^[a-z0-9-]{3,30}$/);
    expect(suggestSlug({ storeName: "!!", socialUrl: null, code: "987654" })).toBe("store-987654");
    expect(suggestSlug({ storeName: "admin", socialUrl: null, code: "111222" })).not.toBe("admin");
  });
});
