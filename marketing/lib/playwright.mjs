// تحميل Playwright من أي مكان متاح دون إضافته إلى تبعيات المشروع.
// الترتيب: مثبّت محلياً، ثم مسار يحدده PLAYWRIGHT_MODULE، ثم المسارات المعروفة في بيئة الجلسة.
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync("/opt/pw-browsers")) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = "/opt/pw-browsers";
}

const roots = [
  here,
  process.env.PLAYWRIGHT_MODULE,
  "/opt/node-tools/",
  "/root/.cache/colapia-dev/node/",
].filter(Boolean);

export function loadPlaywright() {
  for (const root of roots) {
    try {
      return createRequire(path.join(root, "x.js"))("playwright");
    } catch {
      /* جرّب الجذر التالي */
    }
  }
  throw new Error(
    "لم يُعثر على Playwright. ثبّتوه مؤقتاً بالأمر: npm i --no-save playwright ثم npx playwright install chromium",
  );
}

export async function loadSharp() {
  try {
    return (await import("sharp")).default;
  } catch {
    return null;
  }
}
