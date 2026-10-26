#!/usr/bin/env node
// لقطات حقيقية لموقع Qima للمنشور (تُحفظ في shots/). التشغيل:
//   node marketing/qima-post/capture.mjs            (Chromium من Playwright)
//   node marketing/qima-post/capture.mjs --chrome   (Chrome المثبّت على جهازكم: يشغّل الفيديو، والأفضل للأعمال وآراء العملاء)
//   node marketing/qima-post/capture.mjs --url=https://النطاق-النهائي
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPlaywright } from "../lib/playwright.mjs";

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "shots");
mkdirSync(out, { recursive: true });
const urlArg = process.argv.find((a) => a.startsWith("--url="));
const URL_ = urlArg ? urlArg.slice(6) : "https://qima-ten.vercel.app";
const useChrome = process.argv.includes("--chrome");

const { chromium } = loadPlaywright();
const browser = await chromium.launch(useChrome ? { channel: "chrome" } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5, locale: "en-US" });
const p = await ctx.newPage();
await p.goto(URL_, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(3500);

async function warm() {
  const h = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 400) {
    await p.evaluate((v) => window.scrollTo(0, v), y);
    await p.waitForTimeout(220);
  }
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(900);
}
async function shot(name, selector, offset = -70) {
  await p.evaluate(
    ([s, o]) => {
      const el = s === "top" ? null : document.querySelector(s);
      window.scrollTo(0, el ? Math.max(0, el.getBoundingClientRect().top + scrollY + o) : 0);
    },
    [selector, offset],
  );
  await p.waitForTimeout(1300);
  await p.screenshot({ path: path.join(out, name + ".png") });
  console.log("✓", name);
}
// يعلّم قسم «لماذا Qima» أياً كانت لغة الصفحة
async function markWhy() {
  return p.evaluate(() => {
    const s = [...document.querySelectorAll("section")].find((x) => /WHY QIMA|ليه قمة|لماذا قمة/i.test(x.innerText.slice(0, 60)));
    if (!s) return null;
    s.setAttribute("data-why", "1");
    return '[data-why="1"]';
  });
}

await warm();
let why = await markWhy();
await shot("d-hero", "top");
await shot("d-services", "#services");
if (why) await shot("d-why", why, -20);
await shot("d-process", "#process");
await shot("d-contact", "#contact");
await p.setViewportSize({ width: 390, height: 844 });
await p.waitForTimeout(800);
await shot("m-hero", "top");
await shot("m-services", "#services", -20);
await shot("m-process", "#process", -20);

// النسخة العربية
await p.setViewportSize({ width: 1280, height: 800 });
await p.evaluate(() => window.scrollTo(0, 0));
await p.waitForTimeout(800);
await p.locator('button[aria-label="Switch language"]').click();
await p.waitForTimeout(2500);
await warm();
why = await markWhy();
await shot("d-hero-ar", "top");
await shot("d-services-ar", "#services");
if (why) await shot("d-why-ar", why, -20);
await shot("d-process-ar", "#process");
await p.setViewportSize({ width: 390, height: 844 });
await p.waitForTimeout(800);
await shot("m-hero-ar", "top");
await shot("m-services-ar", "#services", -20);

// الأعمال (تحتاج Chrome حقيقياً ليشغّل الفيديو): قسم الأعمال بالإنجليزية والعربية
if (useChrome) {
  await p.setViewportSize({ width: 1280, height: 800 });
  await p.waitForTimeout(600);
  await shot("d-work-ar", "#work", -70);
}
await browser.close();
