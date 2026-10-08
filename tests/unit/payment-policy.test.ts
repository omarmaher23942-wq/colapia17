import { describe, expect, it } from "vitest";
import { assessReceipt, type Verification } from "@/lifecycle/payment-policy";

const ok: Verification = { amountEgp: 899, looksEdited: false, confidence: 0.95, recommendation: "approve", reason: "مطابق" };

describe("payment receipt assessment (owner reviews every payment)", () => {
  it("marks a matching receipt as ok", () => {
    expect(assessReceipt(ok, 899)).toEqual({ level: "ok", summary: "مطابق" });
  });
  it("asks for a manual look when the AI check is unavailable or unsure", () => {
    expect(assessReceipt(null, 899).level).toBe("check");
    expect(assessReceipt({ ...ok, recommendation: "review", confidence: 0.4 }, 899).level).toBe("check");
  });
  it("flags reused, edited or underpaid receipts as danger", () => {
    expect(assessReceipt({ ...ok, duplicate: true }, 899).level).toBe("danger");
    expect(assessReceipt({ ...ok, looksEdited: true, confidence: 0.9 }, 899).level).toBe("danger");
    expect(assessReceipt({ ...ok, amountEgp: 500, confidence: 0.9 }, 899).level).toBe("danger");
  });
  it("does not cry wolf on weak signals", () => {
    expect(assessReceipt({ ...ok, looksEdited: true, confidence: 0.5 }, 899).level).not.toBe("danger");
  });
});
