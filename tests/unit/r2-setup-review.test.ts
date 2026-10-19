import { afterEach, describe, expect, it, vi } from "vitest";
import { isTransientUploadFailure, uploadMany } from "@/lib/media-upload";
import { attributesFor, usesSizeColor, variantOptionSuggestions, NICHES } from "@/lib/niche-attributes";
import { orderMessage, type MessageOrder } from "@/lib/order-messages";

const order: MessageOrder = {
  code: "CLP-1",
  customerName: "سارة علي",
  customerPhone: "01000000000",
  governorate: "cairo",
  address: "شارع 1",
  totalPiasters: 50000,
  paymentMethod: "cod",
  paymentStatus: "pending",
};

describe("upload retries", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("classifies only network and gateway failures as transient", () => {
    expect(isTransientUploadFailure(null, false)).toBe(true);
    expect(isTransientUploadFailure(null, true)).toBe(true);
    for (const s of [502, 503, 504]) expect(isTransientUploadFailure(s, false)).toBe(true);
    for (const s of [400, 403, 413, 429, 500]) expect(isTransientUploadFailure(s, false)).toBe(false);
  });

  it("retries a dropped connection once and then succeeds", async () => {
    vi.useFakeTimers();
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls++;
      if (calls === 1) throw new TypeError("network");
      return new Response(JSON.stringify({ files: [{ key: "k", url: "https://m.test/a.jpg", type: "image/jpeg", size: 5 }] }), { status: 200 });
    });
    const p = uploadMany("productImage", [new File([new Uint8Array(20)], "a.jpg", { type: "image/jpeg" })]);
    await vi.runAllTimersAsync();
    const r = await p;
    expect(calls).toBe(2);
    expect(r.error).toBeNull();
    expect(r.done[0]?.url).toBe("https://m.test/a.jpg");
  });

  it("does not retry quota, rate-limit or validation answers", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls++;
      return new Response(JSON.stringify({ error: "وصلتم لحد مساحة الصور" }), { status: 429 });
    });
    const r = await uploadMany("productImage", [new File([new Uint8Array(20)], "a.jpg", { type: "image/jpeg" })]);
    expect(calls).toBe(1);
    expect(r.done).toHaveLength(0);
    expect(r.error).toBe("وصلتم لحد مساحة الصور");
  });

  it("uses plural-address error messages", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("x");
    });
    const p = uploadMany("productImage", [new File([new Uint8Array(20)], "a.jpg")]);
    await vi.runAllTimersAsync();
    const r = await p;
    expect(r.error).toContain("تأكدوا");
    expect(r.error).not.toMatch(/تأكد من|حاول /);
  });
});

describe("niche-specific option suggestions", () => {
  it("never suggests size for non-fashion niches", () => {
    for (const n of NICHES) {
      const s = variantOptionSuggestions(n);
      expect(s.length).toBeGreaterThan(0);
      if (!usesSizeColor(n)) expect(s).not.toContain("المقاس");
      else expect(s).toContain("المقاس");
    }
  });
  it("perfume and electronics get their own options", () => {
    expect(variantOptionSuggestions("perfume")).toContain("الحجم");
    expect(variantOptionSuggestions("electronics")).toContain("السعة");
    expect(attributesFor("other")).toHaveLength(0);
  });
});

describe("inspection question reaches customer messages", () => {
  it("mentions opening the parcel in confirm and shipped messages for COD only when allowed", () => {
    expect(orderMessage("confirm", { ...order, inspectionAllowed: true }, "متجر")).toContain("معاينتها مع المندوب");
    expect(orderMessage("shipped", { ...order, inspectionAllowed: true }, "متجر")).toContain("معاينتها مع المندوب");
    expect(orderMessage("confirm", { ...order, inspectionAllowed: false }, "متجر")).not.toContain("المندوب");
    expect(orderMessage("confirm", order, "متجر")).not.toContain("المندوب");
  });
  it("does not mention it for prepaid orders", () => {
    const paid = { ...order, paymentMethod: "instapay", paymentStatus: "confirmed", inspectionAllowed: true };
    expect(orderMessage("shipped", paid, "متجر")).not.toContain("معاينتها");
  });
});

describe("identity save keeps the theme fonts unless a different pair is chosen", () => {
  it("does not replace unmatched theme fonts when only the name changes", async () => {
    const { fontsAfterIdentity, pairIdFor } = await import("@/lib/onboarding");
    const custom = { heading: "playfair_x", body: "inter_x" };
    // النموذج يعرض الزوج الأول لأن الخطوط لا تطابق أي زوج، فيعيده كما هو عند الحفظ
    const shown = pairIdFor(custom.heading, custom.body);
    expect(fontsAfterIdentity(custom, shown)).toEqual(custom);
  });
  it("applies the pair the merchant explicitly picked", async () => {
    const { fontsAfterIdentity, FONT_PAIRS, pairIdFor } = await import("@/lib/onboarding");
    const current = { heading: FONT_PAIRS[0]!.heading, body: FONT_PAIRS[0]!.body };
    const other = FONT_PAIRS.find((p) => p.id !== pairIdFor(current.heading, current.body))!;
    expect(fontsAfterIdentity(current, other.id)).toEqual({ heading: other.heading, body: other.body });
  });
  it("ignores an unknown pair id", async () => {
    const { fontsAfterIdentity } = await import("@/lib/onboarding");
    const cur = { heading: "cairo", body: "cairo" };
    expect(fontsAfterIdentity(cur, "nope")).toEqual(cur);
  });
});
