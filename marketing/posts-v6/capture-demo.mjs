#!/usr/bin/env node
// لقطات متجر العرض لمنشورات V6. الأساس: http://demo.localhost:3100 (preview.sh demo) أو --url=https://demo.colapia.com بعد إعادة الزرع.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPlaywright } from "../lib/playwright.mjs";

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "shots");
const urlArg = process.argv.find((a) => a.startsWith("--url="));
const BASE = urlArg ? urlArg.slice(6) : "http://demo.localhost:3100";
const { chromium } = loadPlaywright();
const browser = await chromium.launch();

async function settle(p, ms = 1800) {
  await p.waitForLoadState("domcontentloaded");
  await p.waitForTimeout(ms);
  await p.evaluate(async () => {
    const h = document.documentElement.scrollHeight;
    for (let y = 0; y < h; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
    window.scrollTo(0, 0);
  });
  await p.waitForTimeout(1200);
}

// سطح المكتب
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: "ar-EG" });
  await ctx.addInitScript(() => {
    const css = "nextjs-portal,[data-nextjs-toast],[data-nextjs-dev-tools-button]{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => { const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st); });
  });
  const p = await ctx.newPage();
  await p.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(p);
  await p.screenshot({ path: path.join(out, "demo-home-desktop.png") });
  const h = await p.evaluate(() => document.documentElement.scrollHeight);
  for (const [i, y] of [[2, 900], [3, 1800], [4, 2700]]) {
    if (y < h) { await p.evaluate((v) => window.scrollTo(0, v), y); await p.waitForTimeout(700); await p.screenshot({ path: path.join(out, `demo-home-desktop-${i}.png`) }); }
  }
  await p.goto(BASE + "/all", { waitUntil: "domcontentloaded" });
  await settle(p);
  await p.screenshot({ path: path.join(out, "demo-all-desktop.png") });
  const first = await p.$('a[href^="/p/"]');
  if (first) {
    await first.click();
    await settle(p, 2200);
    await p.screenshot({ path: path.join(out, "demo-product-desktop.png") });
  }
  await ctx.close();
}
// موبايل
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: "ar-EG" });
  await ctx.addInitScript(() => {
    const css = "nextjs-portal,[data-nextjs-toast],[data-nextjs-dev-tools-button]{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => { const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st); });
  });
  const p = await ctx.newPage();
  await p.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(p);
  await p.screenshot({ path: path.join(out, "demo-home-mobile.png") });
  await p.evaluate(() => window.scrollTo(0, 900)); await p.waitForTimeout(700);
  await p.screenshot({ path: path.join(out, "demo-home-mobile-2.png") });
  await p.goto(BASE + "/all", { waitUntil: "domcontentloaded" });
  await settle(p);
  await p.screenshot({ path: path.join(out, "demo-all-mobile.png") });
  const first = await p.$('a[href^="/p/"]');
  if (first) { await first.click(); await settle(p, 2200); await p.screenshot({ path: path.join(out, "demo-product-mobile.png") }); }
  await ctx.close();
}
await browser.close();
console.log("done");
