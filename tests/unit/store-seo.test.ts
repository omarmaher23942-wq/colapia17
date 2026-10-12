import { describe, expect, it } from "vitest";
import { publicStoreUrl } from "@/lib/utils";

describe("public store url", () => {
  it("prefers an active custom domain for canonical links", () => {
    expect(publicStoreUrl({ subdomain: "nova", customDomain: "nova-shop.com", customDomainStatus: "active" }, "/p/x")).toBe("https://nova-shop.com/p/x");
  });
  it("falls back to the subdomain until the domain is active", () => {
    const u = publicStoreUrl({ subdomain: "nova", customDomain: "nova-shop.com", customDomainStatus: "pending" }, "/p/x");
    expect(u).toContain("nova.");
    expect(u.endsWith("/p/x")).toBe(true);
  });
});
