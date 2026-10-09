import { describe, expect, it } from "vitest";
import { arCount, fmtNum, NOUN } from "@/lib/format";

describe("fmtNum", () => {
  it("uses Latin digits with thousands separators", () => {
    expect(fmtNum(1250)).toBe("1,250");
    expect(fmtNum(0)).toBe("0");
    expect(fmtNum(Number.NaN)).toBe("0");
  });
});

describe("arCount (Arabic number agreement)", () => {
  it.each([
    [1, "طلب واحد"],
    [2, "طلبان"],
    [3, "3 طلبات"],
    [10, "10 طلبات"],
    [11, "11 طلباً"],
    [99, "99 طلباً"],
    [100, "100 طلب"],
    [103, "103 طلبات"],
    [1250, "1,250 طلباً"],
  ])("%i → %s", (n, expected) => {
    expect(arCount(n, NOUN.order)).toBe(expected);
  });

  it("keeps the adjective agreeing with the noun", () => {
    expect(arCount(1, NOUN.newOrder)).toBe("طلب جديد");
    expect(arCount(2, NOUN.newOrder)).toBe("طلبان جديدان");
    expect(arCount(5, NOUN.newOrder)).toBe("5 طلبات جديدة");
    expect(arCount(12, NOUN.newOrder)).toBe("12 طلباً جديداً");
  });
});
