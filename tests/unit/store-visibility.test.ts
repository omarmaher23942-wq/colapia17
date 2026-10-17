import { describe, expect, it } from "vitest";
import { gateShowsName, storeVisibility } from "@/lib/store-visibility";

const none = { phase: "none" };

describe("storeVisibility", () => {
  it("setup is hidden from everyone and never indexed", () => {
    expect(storeVisibility({ status: "setup" }, none)).toEqual({ public: false, gate: "setup", indexable: false });
  });

  it("legacy build statuses are gated like setup (review is no longer public)", () => {
    for (const status of ["intake", "pending_review", "building", "review"]) {
      expect(storeVisibility({ status }, none)).toEqual({ public: false, gate: "setup", indexable: false });
    }
  });

  it("trial is public but not indexable", () => {
    expect(storeVisibility({ status: "trial" }, none)).toEqual({ public: true, gate: null, indexable: false });
  });

  it("active is public and indexable while hosting serves", () => {
    for (const phase of ["active", "renew_soon", "grace", "lifetime", "none"]) {
      expect(storeVisibility({ status: "active" }, { phase })).toEqual({ public: true, gate: null, indexable: true });
    }
  });

  it("active with paused/offline hosting is gated", () => {
    expect(storeVisibility({ status: "active" }, { phase: "paused" }).gate).toBe("paused");
    expect(storeVisibility({ status: "active" }, { phase: "offline" }).gate).toBe("offline");
    expect(storeVisibility({ status: "active" }, { phase: "paused" }).public).toBe(false);
  });

  it("frozen, suspended, deleted and soft-deleted are hidden", () => {
    expect(storeVisibility({ status: "frozen" }, none).gate).toBe("frozen");
    expect(storeVisibility({ status: "suspended" }, none).gate).toBe("unavailable");
    expect(storeVisibility({ status: "deleted" }, none).gate).toBe("unavailable");
    expect(storeVisibility({ status: "active", deletedAt: new Date() }, { phase: "active" }).public).toBe(false);
  });

  it("setup gate never reveals the store name", () => {
    expect(gateShowsName("setup")).toBe(false);
    expect(gateShowsName("frozen")).toBe(true);
    expect(gateShowsName(null)).toBe(true);
  });
});
