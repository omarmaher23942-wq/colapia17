import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";

type MiddlewareFn = (req: NextRequest) => Response;
let middleware: MiddlewareFn;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_ROOT_DOMAIN = "colapia.com";
  ({ middleware } = (await import("@/middleware")) as unknown as { middleware: MiddlewareFn });
});

const run = (url: string, headers: Record<string, string> = {}) => {
  const u = new URL(url);
  return middleware(new NextRequest(u, { headers: { host: u.host, ...headers } }));
};

const rewriteTarget = (res: Response) => res.headers.get("x-middleware-rewrite");
const forwarded = (res: Response, name: string) =>
  res.headers.get(`x-middleware-request-${name}`);

describe("tenant routing", () => {
  it("rewrites a store subdomain into its own /s/{sub} tree", () => {
    const res = run("https://shop.colapia.com/p/dress");
    expect(rewriteTarget(res)).toBe("https://shop.colapia.com/s/shop/p/dress");
    expect(forwarded(res, "x-store-subdomain")).toBe("shop");
  });

  it("blocks direct /s/* access on the platform domain (no shared origin between stores)", () => {
    expect(run("https://colapia.com/s/shop").status).toBe(404);
    expect(run("https://colapia.com/s/shop/p/dress").status).toBe(404);
  });

  it("blocks /s/* on a store domain too (no reaching another store through a store)", () => {
    expect(run("https://shop.colapia.com/s/other").status).toBe(404);
  });

  it("strips a spoofed store header on the platform domain", () => {
    const res = run("https://colapia.com/", { "x-store-subdomain": "victim" });
    expect(forwarded(res, "x-store-subdomain")).toBeNull();
  });

  it("serves robots/sitemap/manifest on store domains with the store identity", () => {
    for (const path of ["/robots.txt", "/sitemap.xml", "/manifest.webmanifest"]) {
      const res = run(`https://shop.colapia.com${path}`);
      expect(rewriteTarget(res)).toBeNull();
      expect(forwarded(res, "x-store-subdomain")).toBe("shop");
    }
  });

  it("serves the store's own favicon, never the platform's", () => {
    const res = run("https://shop.colapia.com/favicon.ico");
    expect(rewriteTarget(res)).toBe("https://shop.colapia.com/api/storefront/icon");
  });

  it("rejects reserved subdomains", () => {
    expect(run("https://admin.colapia.com/").status).toBe(404);
  });
});
