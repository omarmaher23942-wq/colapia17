#!/usr/bin/env node
// env-to-secrets.mjs — يحوّل ملف متغيرات مسحوب من Vercel (vercel env pull) إلى ملف JSON يقبله
// `wrangler secret bulk`، فتُنقل كل المفاتيح إلى Cloudflare بأمر واحد بدل نسخها واحداً واحداً.
//
// الاستخدام (على جهازك، داخل مجلد المشروع):
//   npx vercel env pull .env.cloudflare --environment=production
//   node scripts/ops/env-to-secrets.mjs .env.cloudflare > secrets.json
//   npx wrangler secret bulk secrets.json
//   (ثم احذف الملفين: del .env.cloudflare secrets.json  — أو rm على ماك/لينكس)
//
// يتخطى: متغيرات NEXT_PUBLIC_* (تُضبط في Build variables لأنها تدخل الكود وقت البناء)، والمتغيرات المكتوبة في
// wrangler.jsonc، ومتغيرات Vercel الداخلية (VERCEL_*، TURBO_*، NX_*)، والقيم الفارغة. لا يطبع أي قيمة على الشاشة.
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("اكتب اسم الملف: node scripts/ops/env-to-secrets.mjs .env.cloudflare > secrets.json");
  process.exit(1);
}

const IN_WRANGLER = new Set(["NEXT_PUBLIC_ROOT_DOMAIN", "ROOT_DOMAIN", "NEXT_PUBLIC_APP_URL", "TRUST_CF_CONNECTING_IP"]);
const SKIP = /^(NEXT_PUBLIC_|VERCEL|TURBO_|NX_)/;

const out = {};
const skipped = [];
for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const m = /^(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
  if (!m) continue;
  const [, key, rest] = m;
  let value = rest.trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1).replace(/\\n/g, "\n");
  }
  if (!value || SKIP.test(key) || IN_WRANGLER.has(key)) {
    skipped.push(key);
    continue;
  }
  out[key] = value;
}

process.stdout.write(JSON.stringify(out, null, 2) + "\n");
console.error(`✓ ${Object.keys(out).length} مفتاحاً جاهزاً للنقل. تُخطّي (تُضبط في مكان آخر أو فارغة): ${skipped.join(", ") || "لا شيء"}`);
if (!out.CRON_SECRET) console.error("⚠ CRON_SECRET غير موجود: أضفه (أي نص عشوائي طويل) وإلا لن تعمل المهام المجدولة على Cloudflare.");
