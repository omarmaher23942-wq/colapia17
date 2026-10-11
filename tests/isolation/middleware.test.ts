import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";

type MiddlewareFn = (req: NextRequest) => Response | Promise<Response>;
let middleware: MiddlewareFn;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_ROOT_DOMAIN = "colapia.com";
  ({ middleware } = (await import("@/middleware")) as unknown as { middleware: MiddlewareFn });
});

const run = async (url: string, headers: Record<string, string> = {}): Promise<Response> => {
  const u = new URL(url);
  return middleware(new NextRequest(u, { headers: { host: u.host, ...headers } }));
};

const rewriteTarget = (res: Response) => res.headers.get("x-middleware-rewrite");
const forwarded = (res: Response, name: string) =>
  res.headers.get(`x-middleware-request-${name}`);

describe("tenant routing", () => {
  it("rewrites a store subdomain into its own /s/{sub} tree", async () => {
    const res = await run("https://shop.colapia.com/p/dress");
    expect(rewriteTarget(res)).toBe("https://shop.colapia.com/s/shop/p/dress");
    expect(forwarded(res, "x-store-subdomain")).toBe("shop");
  });

  it("blocks direct /s/* access on the platform domain (no shared origin between stores)", async () => {
    expect((await run("https://colapia.com/s/shop")).status).toBe(404);
    expect((await run("https://colapia.com/s/shop/p/dress")).status).toBe(404);
  });

  it("blocks /s/* on a store domain too (no reaching another store through a store)", async () => {
    expect((await run("https://shop.colapia.com/s/other")).status).toBe(404);
  });

  it("strips a spoofed store header on the platform domain", async () => {
    const res = await run("https://colapia.com/", { "x-store-subdomain": "victim" });
    expect(forwarded(res, "x-store-subdomain")).toBeNull();
  });

  it("serves robots/sitemap/manifest on store domains with the store identity", async () => {
    for (const path of ["/robots.txt", "/sitemap.xml", "/manifest.webmanifest"]) {
      const res = await run(`https://shop.colapia.com${path}`);
      expect(rewriteTarget(res)).toBeNull();
      expect(forwarded(res, "x-store-subdomain")).toBe("shop");
    }
  });

  it("serves the store's own favicon, never the platform's", async () => {
    const res = await run("https://shop.colapia.com/favicon.ico");
    expect(rewriteTarget(res)).toBe("https://shop.colapia.com/api/storefront/icon");
  });

  it("rejects reserved subdomains", async () => {
    expect((await run("https://admin.colapia.com/")).status).toBe(404);
  });
});
