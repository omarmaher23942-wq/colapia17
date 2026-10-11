// shot.mjs — لقطات شاشة للمعاينة (موبايل 375px وسطح مكتب) بجلسة التاجر التجريبية، مع فحص التمرير الأفقي
// وأخطاء المتصفح. يُشغَّل عبر: bash scripts/dev/preview.sh shot <path> [name] [mobile|desktop|both] [dark|light] [--full] [--click=css] [--wait=ms] [--store=<sub>]
// اللقطات في $DEVSTACK_SHOTS (افتراضياً ~/.cache/colapia-dev/shots).
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const cache = process.env.DEVSTACK_HOME ?? join(process.env.HOME ?? ".", ".cache/colapia-dev");
const { chromium } = createRequire(join(cache, "node/"))("playwright");

const [, , path = "/dashboard", name = "shot", mode = "both", theme = "dark", ...rest] = process.argv;
const full = rest.includes("--full");
const click = rest.find((r) => r.startsWith("--click="))?.slice(8);
// --store=atelier: صفحة متجر على نطاقه (atelier.localhost:3100)، كما يراها الزائر.
const store = rest.find((r) => r.startsWith("--store="))?.slice(8);
const origin = store ? `http://${store}.localhost:3100` : "http://localhost:3100";
// --as=builder|reviewer|sales: لوحة الوكالة بجلسة عضو بذلك الدور (من seed) بدل المالك.
const as = rest.find((r) => r.startsWith("--as="))?.slice(5);
const ptoken = as ? `dev-platform-${as}-token-`.padEnd(41, "0") : "dev-platform-session-token-00000000000000";
const wait = Number(rest.find((r) => r.startsWith("--wait="))?.slice(7) ?? 600);
const out = process.env.DEVSTACK_SHOTS ?? join(cache, "shots");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox"] });
for (const s of mode === "both" ? ["mobile", "desktop"] : [mode]) {
  const width = s === "mobile" ? 375 : 1440;
  const ctx = await browser.newContext({ viewport: { width, height: s === "mobile" ? 812 : 900 }, isMobile: s === "mobile", hasTouch: s === "mobile", locale: "ar-EG" });
  await ctx.addCookies(
    [
      ["clp_m", rest.includes("--member") ? "dev-member-orders-token-000000000000000000" : "dev-merchant-session-token-0000000000000000"],
      ["clp_p", ptoken],
      ["clp_dash_theme", theme],
      ["clp_tour_v2_seen", "1"],
    ].map(([n, v]) => ({ name: n, value: v, domain: "localhost", path: "/" }))
  );
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text().slice(0, 300)}`));
  const res = await page.goto(`${origin}${path}`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForTimeout(wait);
  if (click) {
    await page.click(click);
    await page.waitForTimeout(700);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (full) {
    // لقطة بطول الصفحة بتكبير نافذة العرض (الخلفيات الثابتة تمتد معها، بخلاف fullPage).
    const h = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
    await page.setViewportSize({ width, height: Math.min(h, 6000) });
    await page.waitForTimeout(500);
  }
  const file = join(out, `${name}-${s}.png`);
  await page.screenshot({ path: file });
  console.log(`${s}: ${res?.status()} overflowX=${overflow}px → ${file}${errors.length ? `\n  ${errors.slice(0, 6).join("\n  ")}` : ""}`);
  await ctx.close();
}
await browser.close();
