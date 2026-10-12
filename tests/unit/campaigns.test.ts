import { describe, expect, it } from "vitest";
import { campaignDestination, campaignSlug, orderSourceFrom, type Campaign } from "@/lib/campaigns";
import { campaignSchema } from "@/blueprint/schema";

const c = (o: Partial<Campaign> = {}): Campaign => campaignSchema.parse({ slug: "summer", name: "صيف", platform: "instagram", ...o });

describe("campaign links", () => {
  it("makes unique latin slugs from Arabic names", () => {
    expect(campaignSlug("فستان الصيف", [])).toBe("fstan-alsyf");
    expect(campaignSlug("فستان الصيف", ["fstan-alsyf"])).toBe("fstan-alsyf-2");
    expect(campaignSlug("!!", [])).toMatch(/^ad/);
    expect(campaignSchema.shape.slug.safeParse(campaignSlug("عرض 11.11", [])).success).toBe(true);
  });

  it("builds the destination with utm and promo", () => {
    expect(campaignDestination(c())).toBe("/?utm_source=instagram&utm_medium=ad&utm_campaign=summer");
    expect(campaignDestination(c({ target: { type: "product", slug: "فستان" }, code: "SUM10" }))).toBe("/p/%D9%81%D8%B3%D8%AA%D8%A7%D9%86?utm_source=instagram&utm_medium=ad&utm_campaign=summer&promo=SUM10");
  });

  it("attributes orders only to campaigns that still exist", () => {
    expect(orderSourceFrom("summer", [c()])).toBe("campaign:summer");
    expect(orderSourceFrom("gone", [c()])).toBe("storefront");
    expect(orderSourceFrom(undefined, [c()])).toBe("storefront");
  });
});
