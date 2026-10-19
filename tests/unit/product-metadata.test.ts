import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { productMetadata } from "@/lib/storefront-seo";

const base = {
  name: "قميص", slug: "shirt", shortDescription: "قميص قطن", description: null, seoTitle: null, seoDescription: null,
  pricePiasters: 10000, compareAtPiasters: null, sku: null, stock: null, trackStock: false, images: [] as { url: string; alt?: string }[],
  ratingSum: 0, ratingCount: 0,
};

describe("productMetadata", () => {
  it("يحمل اسم الموقع واللغة لأن openGraph الصفحة تستبدل مجموعة التخطيط", () => {
    const m = productMetadata(base, { name: "متجري", image: "https://x.test/logo.png" });
    expect((m.openGraph as { siteName?: string }).siteName).toBe("متجري");
    expect((m.openGraph as { locale?: string }).locale).toBe("ar_EG");
  });
  it("منتج بلا صور يرث صورة المتجر، وصور المنتج تتقدم عليها", () => {
    const none = productMetadata(base, { name: "متجري", image: "https://x.test/logo.png" });
    expect(JSON.stringify(none.openGraph)).toContain("logo.png");
    const own = productMetadata({ ...base, images: [{ url: "https://x.test/p.jpg" }] }, { name: "متجري", image: "https://x.test/logo.png" });
    expect(JSON.stringify(own.openGraph)).toContain("p.jpg");
    expect(JSON.stringify(own.openGraph)).not.toContain("logo.png");
  });
});
