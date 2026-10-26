#!/usr/bin/env node
// تحويل شرائح HTML إلى PNG بمقاس 1080×1350.
//   node marketing/render.mjs marketing/qima-post          → slide-01.png … بجوار كل slide-NN.html
//   node marketing/render.mjs marketing/qima-post --only 3 → شريحة واحدة
//   node marketing/render.mjs <dir> --raw                  → بلا ضغط
// لا طلبات خارجية: أي طلب غير محلي يُحجب ويُبلَّغ عنه. الخطوط محلية من marketing/fonts.
import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadPlaywright, loadSharp } from "./lib/playwright.mjs";

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--"));
if (!dir) {
  console.error("الاستخدام: node marketing/render.mjs <مجلد الشرائح> [--only N] [--raw]");
  process.exit(1);
}
const only = args.includes("--only") ? Number(args[args.indexOf("--only") + 1]) : null;
const raw = args.includes("--raw");
const W = 1080;
const H = 1350;

const abs = path.resolve(dir);
const files = readdirSync(abs)
  .filter((f) => /^slide-\d+\.html$/.test(f))
  .filter((f) => only == null || Number(f.match(/\d+/)[0]) === only)
  .sort();
if (!files.length) {
  console.error(`لا توجد ملفات slide-NN.html في ${abs}`);
  process.exit(1);
}

const { chromium } = loadPlaywright();
const sharp = raw ? null : await loadSharp();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: "ar-EG" });
let problems = 0;
let total = 0;

for (const file of files) {
  const page = await ctx.newPage();
  const blocked = [];
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith("file:") || url.startsWith("data:")) return route.continue();
    blocked.push(url);
    return route.abort();
  });
  await page.goto(pathToFileURL(path.join(abs, file)).href, { waitUntil: "load" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => (i.decode ? i.decode().catch(() => {}) : null)));
  });

  const report = await page.evaluate(
    ({ W, H }) => {
      const out = { fonts: document.fonts.check('900 40px "Cairo"', "ابج"), overflow: [], broken: [] };
      const slide = document.querySelector(".slide");
      if (!slide) out.overflow.push("لا يوجد عنصر .slide");
      else if (slide.scrollHeight > H + 1) out.overflow.push(`ارتفاع المحتوى ${slide.scrollHeight} أكبر من ${H}`);
      for (const el of document.querySelectorAll(".slide *")) {
        if (el.closest(".clip")) continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (r.right > W + 1 || r.left < -1 || r.bottom > H + 1) {
          out.overflow.push(`${el.tagName}.${el.className || ""} يخرج عن الإطار (${Math.round(r.left)}..${Math.round(r.right)} × ${Math.round(r.bottom)})`);
        }
      }
      for (const img of document.images) if (!img.naturalWidth) out.broken.push(img.getAttribute("src"));
      return out;
    },
    { W, H },
  );

  const name = file.replace(/\.html$/, ".png");
  let buf = await page.screenshot({ clip: { x: 0, y: 0, width: W, height: H }, type: "png" });
  if (sharp) buf = await sharp(buf).png({ palette: true, quality: 92, effort: 10, colours: 256, dither: 0.6 }).toBuffer();
  writeFileSync(path.join(abs, name), buf);
  total += buf.length;

  const issues = [
    ...(report.fonts ? [] : ["خط Cairo لم يُحمَّل"]),
    ...report.overflow.slice(0, 4),
    ...report.broken.map((s) => `صورة مكسورة: ${s}`),
    ...blocked.map((u) => `طلب خارجي محجوب: ${u}`),
  ];
  problems += issues.length;
  console.log(`${issues.length ? "✗" : "✓"} ${name}  ${(buf.length / 1024).toFixed(0)}KB${issues.length ? "\n    " + issues.join("\n    ") : ""}`);
  await page.close();
}

await browser.close();
console.log(`\n${files.length} شريحة، المجموع ${(total / 1048576).toFixed(2)}MB${sharp ? "" : " (بلا ضغط)"}`);
process.exit(problems ? 2 : 0);
