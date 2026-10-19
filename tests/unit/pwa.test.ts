import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  INSTALL_DISMISS_DAYS, STORE_ICON_PATH, isBotAgent, isDismissed, isIosSafari,
  platformManifest, storeIconLinks, storeManifest, storeShouldPrompt,
} from "@/lib/pwa";

describe("platform manifest", () => {
  const m = platformManifest();
  it("is RTL Arabic standalone with 192/512/maskable PNG icons", () => {
    expect(m).toMatchObject({ name: "كولابيا", dir: "rtl", lang: "ar", display: "standalone", start_url: "/" });
    const purposes = m.icons.map((i) => `${i.sizes}:${i.purpose}`);
    expect(purposes).toEqual(expect.arrayContaining(["192x192:any", "512x512:any", "512x512:maskable"]));
    for (const i of m.icons) expect(readFileSync(`public${i.src}`).length).toBeGreaterThan(500);
  });
});

describe("store manifest", () => {
  it("uses the store identity and never the platform's", () => {
    const m = storeManifest({ name: "نور للأزياء", logoUrl: "https://cdn.example.com/logo.png", palette: { background: "#fafafa", primary: "#123456" } });
    expect(m.name).toBe("نور للأزياء");
    expect(m.theme_color).toBe("#123456");
    expect(m.background_color).toBe("#fafafa");
    expect(m.icons[0]?.src).toBe("https://cdn.example.com/logo.png");
    expect(JSON.stringify(m)).not.toMatch(/كولابيا|colapia|"\/logo\.png"|"\/icons\//i);
  });
  it("falls back to the generated initial icon, ignores bad colours and unsafe logo", () => {
    const m = storeManifest({ name: "متجر", logoUrl: "javascript:alert(1)", palette: { primary: "red;x" } });
    expect(m.icons[0]).toMatchObject({ src: STORE_ICON_PATH, type: "image/svg+xml", sizes: "any" });
    expect(m.theme_color).toBe("#111827");
  });
  it("truncates short_name by characters", () => {
    expect(Array.from(storeManifest({ name: "اسم متجر طويل جداً جداً" }).short_name).length).toBeLessThanOrEqual(12);
  });
});

describe("store icons are never the platform's", () => {
  it("storeIconLinks points only to the store icon route", () => {
    expect(Object.values(storeIconLinks()).every((v) => v === STORE_ICON_PATH)).toBe(true);
  });
  it("middleware rewrites /favicon.ico on store hosts to the store icon", () => {
    const src = readFileSync("src/middleware.ts", "utf8");
    expect(src).toMatch(/pathname === "\/favicon\.ico"[\s\S]{0,80}STORE_ICON_PATH/);
  });
  it("store metadata uses storeIconLinks", () => {
    expect(readFileSync("src/lib/storefront-seo.ts", "utf8")).toContain("icons: storeIconLinks()");
  });
});

describe("install prompt rules", () => {
  it("dismiss lasts 14 days", () => {
    const now = Date.now();
    expect(isDismissed(now - 13 * 86_400_000, now)).toBe(true);
    expect(isDismissed(now - (INSTALL_DISMISS_DAYS + 1) * 86_400_000, now)).toBe(false);
    expect(isDismissed(null, now)).toBe(false);
  });
  it("detects bots and iOS Safari only", () => {
    expect(isBotAgent("Googlebot/2.1")).toBe(true);
    expect(isBotAgent("")).toBe(true);
    const safari = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    expect(isIosSafari(safari)).toBe(true);
    expect(isIosSafari(safari.replace("Safari/604.1", "CriOS/120 Safari/604.1"))).toBe(false);
    expect(isIosSafari("Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537.36")).toBe(false);
  });
  it("store prompt: after 2nd view or add-to-cart, never in checkout", () => {
    expect(storeShouldPrompt({ pageViews: 1, addedToCart: false, path: "/" })).toBe(false);
    expect(storeShouldPrompt({ pageViews: 2, addedToCart: false, path: "/p/x" })).toBe(true);
    expect(storeShouldPrompt({ pageViews: 1, addedToCart: true, path: "/p/x" })).toBe(true);
    expect(storeShouldPrompt({ pageViews: 5, addedToCart: true, path: "/checkout" })).toBe(false);
    expect(storeShouldPrompt({ pageViews: 5, addedToCart: true, path: "/order/CLP-1" })).toBe(false);
  });
});

describe("service worker safety", () => {
  const sw = readFileSync("public/sw.js", "utf8");
  it("never handles non-GET or API/auth/dashboard caching", () => {
    expect(sw).toContain('req.method !== "GET"');
    expect(sw).toMatch(/PRIVATE = \/\^\\\/\(api\|dashboard\|admin\|login/);
  });
});
