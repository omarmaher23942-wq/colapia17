import { describe, expect, it } from "vitest";
import { launchCopy } from "@/lib/launch-copy";

describe("launch copy", () => {
  it("uses only the store's own facts, price and link", () => {
    const c = launchCopy({ storeName: "نوفا", tagline: "أزياء يومية", url: "https://nova.colapia.com", facts: ["الدفع عند الاستلام", "الشحن لـ 27 محافظة"], product: { name: "فستان كتان", pricePiasters: 39900, compareAtPiasters: 49900 }, code: { code: "NEW10", label: "خصم 10%" } });
    const all = c.map((x) => x.text).join("\n");
    expect(all).toContain("https://nova.colapia.com");
    expect(all).toContain("فستان كتان");
    expect(all).toContain("بدل");
    expect(all).toContain("NEW10");
    expect(all).toContain("الشحن لـ 27 محافظة");
    expect(c.map((x) => x.key)).toEqual(["ad_short", "ad_long", "headlines", "whatsapp", "bio", "caption"]);
  });

  it("does not invent anything when data is missing", () => {
    const c = launchCopy({ storeName: "نوفا", url: "https://n", facts: [] });
    const all = c.map((x) => x.text).join("\n");
    expect(all).not.toMatch(/خصم|بدل|✓|undefined|null/);
    c.find((x) => x.key === "headlines")!.text.split("\n").forEach((h) => expect(h.length).toBeLessThanOrEqual(40));
  });
});
