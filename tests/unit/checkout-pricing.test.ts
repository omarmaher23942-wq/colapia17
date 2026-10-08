import { describe, it, expect } from "vitest";
import { savingsPercent, toPiasters, toEgp } from "@/lib/money";

describe("Pricing & Money Utilities", () => {
  it("should convert EGP to Piasters correctly", () => {
    expect(toPiasters(150)).toBe(15000);
    expect(toPiasters(150.5)).toBe(15050);
  });

  it("should convert Piasters to EGP correctly", () => {
    expect(toEgp(15000)).toBe(150);
    expect(toEgp(15050)).toBe(150.5);
  });

  it("should calculate savings percentage correctly", () => {
    expect(savingsPercent(80, 100)).toBe(20);
    expect(savingsPercent(150, 200)).toBe(25);
    expect(savingsPercent(100, 100)).toBe(0);
    expect(savingsPercent(120, 100)).toBe(0); // No negative savings
    expect(savingsPercent(100, null)).toBe(0);
  });
});