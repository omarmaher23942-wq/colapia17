import { describe, expect, it } from "vitest";
import { cleanSecretValue } from "@/lib/env";

describe("cleanSecretValue", () => {
  it("يعيد الرمز نظيفاً كما يُلصق عادةً", () => {
    expect(cleanSecretValue("EAAGabc123")).toBe("EAAGabc123");
    expect(cleanSecretValue("  EAAGabc123\n")).toBe("EAAGabc123");
    expect(cleanSecretValue('"EAAGabc123"')).toBe("EAAGabc123");
    expect(cleanSecretValue("'EAAGabc123'")).toBe("EAAGabc123");
    expect(cleanSecretValue("META_PAGE_ACCESS_TOKEN=EAAGabc123")).toBe("EAAGabc123");
    expect(cleanSecretValue('export META_PAGE_ACCESS_TOKEN="EAAGabc123"')).toBe("EAAGabc123");
    expect(cleanSecretValue("Bearer EAAGabc123")).toBe("EAAGabc123");
    expect(cleanSecretValue("EAAG abc\n123")).toBe("EAAGabc123");
  });
  it("الفارغ وغير النص = غير مضبوط", () => {
    expect(cleanSecretValue("")).toBeUndefined();
    expect(cleanSecretValue('""')).toBeUndefined();
    expect(cleanSecretValue(undefined)).toBeUndefined();
  });
});
