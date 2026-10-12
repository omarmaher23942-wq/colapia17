import { describe, expect, it } from "vitest";
import { cleanCapiToken, cleanGa4, cleanGoogleVerification, cleanMetaPixel, cleanTiktokPixel, e164Egypt, trackingFrom } from "@/lib/tracking";
import { feedAvailable, renderProductFeed, type FeedProduct } from "@/lib/product-feed";
import { capiPurchasePayload } from "@/server/meta-capi";

describe("tracking ids", () => {
  it("extracts ids from pasted snippets and rejects junk", () => {
    expect(cleanMetaPixel("fbq('init', '1234567890123456');")).toBe("1234567890123456");
    expect(cleanMetaPixel("abc")).toBeNull();
    expect(cleanGa4("g-ab12cd34ef")).toBe("G-AB12CD34EF");
    expect(cleanGa4("UA-1234")).toBeNull();
    expect(cleanTiktokPixel("ttq.load('C4ABCDEFGHIJKLMNOP12');")).toBe("C4ABCDEFGHIJKLMNOP12");
    expect(cleanTiktokPixel("<script>alert(1)</script>")).toBeNull();
    expect(cleanGoogleVerification('<meta name="google-site-verification" content="abcDEF123_-xyz7890qwerty" />')).toBe("abcDEF123_-xyz7890qwerty");
    expect(cleanGoogleVerification('x" onload="alert(1)')).toBeNull();
    expect(cleanCapiToken("EAAG" + "a".repeat(80))).toBe("EAAG" + "a".repeat(80));
    expect(cleanCapiToken("short")).toBeNull();
  });

  it("never lets a raw value through to the page", () => {
    const ids = trackingFrom({ metaPixelId: "'); evil(); //", gaMeasurementId: "G-OK12", tiktokPixelId: "", googleVerification: undefined });
    expect(ids).toEqual({ metaPixelId: null, gaMeasurementId: "G-OK12", tiktokPixelId: null, googleVerification: null });
  });

  it("normalizes Egyptian phones for hashing", () => {
    expect(e164Egypt("0101 234 5678")).toBe("201012345678");
    expect(e164Egypt("+20 101 234 5678")).toBe("201012345678");
    expect(e164Egypt("123")).toBeNull();
  });
});

describe("conversions api payload", () => {
  it("hashes customer data and dedupes by order code", () => {
    const p = capiPurchasePayload({
      pixelId: "1234567890",
      token: "t",
      orderCode: "CLP-1001",
      totalPiasters: 45900,
      contentIds: ["p1"],
      numItems: 2,
      phone: "01012345678",
      email: "A@B.com",
      name: "سارة محمود",
      url: "https://x.colapia.com/checkout",
      at: new Date("2026-10-12T10:00:00Z"),
    }).data[0]!;
    expect(p.event_id).toBe("CLP-1001");
    expect(p.custom_data.value).toBe(459);
    expect(p.user_data.ph![0]).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(p)).not.toContain("01012345678");
    expect(JSON.stringify(p)).not.toContain("A@B.com");
  });
});

const product = (o: Partial<FeedProduct> = {}): FeedProduct => ({
  id: "p1",
  name: "تيشيرت <قطن> & ناعم",
  slug: "tee",
  description: "<p>قطن 100%</p>",
  pricePiasters: 35000,
  compareAtPiasters: null,
  images: [{ url: "https://utfs.io/f/a.jpg" }],
  stock: 5,
  trackStock: true,
  category: "ملابس",
  sku: null,
  ...o,
});

describe("product feed", () => {
  it("writes escaped Merchant/Meta items with sale price and availability", () => {
    const xml = renderProductFeed({ storeName: "نوفا", storeUrl: "https://nova.colapia.com/", products: [product({ compareAtPiasters: 45000 }), product({ id: "p2", images: [] }), product({ id: "p3", images: [{ url: "data:image/png;base64,AAA" }] })] });
    expect(xml).toContain("<g:title>تيشيرت &lt;قطن&gt; &amp; ناعم</g:title>");
    expect(xml).toContain("<g:price>450.00 EGP</g:price>");
    expect(xml).toContain("<g:sale_price>350.00 EGP</g:sale_price>");
    expect(xml).toContain("<g:link>https://nova.colapia.com/p/tee</g:link>");
    expect(xml).toContain("<g:description>قطن 100%</g:description>");
    expect(xml.match(/<item>/g)).toHaveLength(1);
  });

  it("availability follows stock tracking", () => {
    expect(feedAvailable({ stock: 0, trackStock: true })).toBe(false);
    expect(feedAvailable({ stock: 0, trackStock: false })).toBe(true);
    expect(feedAvailable({ stock: null, trackStock: true })).toBe(true);
  });
});
