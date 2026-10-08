// trace-imports.mjs — يتتبع شجرة الاستيراد من ملفات دخول، ويطبع الملفات المحلية التي تصلها.
// الاستخدام: node scripts/trace-imports.mjs <entry...>   (يدعم @/ والمسارات النسبية)
// يُستخدم لفحص حدود قالب "متجر التاجر" (scripts/build-store-template.ts يعتمد على نفس المنطق).
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";

const ROOT = process.cwd();
const EXT = [".ts", ".tsx", ".js", ".mjs", ".css"];

export function resolveImport(from, spec, overlay = new Map()) {
  let base;
  if (spec.startsWith("@/")) base = join(ROOT, "src", spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else return null;
  const cands = [base, ...EXT.map((e) => base + e), ...EXT.map((e) => join(base, "index" + e))];
  for (const c of cands) {
    const rel = relative(ROOT, c).split("\\").join("/");
    if (overlay.has(rel)) return rel;
    if (existsSync(c) && statSync(c).isFile()) return rel;
  }
  return undefined;
}

const RE = /(?:import|export)\s[^'"]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s+["']([^"']+)["']|@import\s+["']([^"']+)["']/g;

export function specsOf(code) {
  const out = [];
  for (const m of code.matchAll(RE)) out.push(m[1] ?? m[2] ?? m[3] ?? m[4]);
  return out;
}

export function trace(entries, { overlay = new Map(), read = (f) => readFileSync(join(ROOT, f), "utf8") } = {}) {
  const seen = new Set();
  const missing = [];
  const stack = [...entries];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    const code = overlay.has(f) ? overlay.get(f) : read(f);
    for (const spec of specsOf(code)) {
      const r = resolveImport(join(ROOT, f), spec, overlay);
      if (r === null) continue;
      if (r === undefined) missing.push(`${f} -> ${spec}`);
      else if (!seen.has(r)) stack.push(r);
    }
  }
  return { files: [...seen].sort(), missing };
}

export function walk(dir) {
  const out = [];
  for (const n of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${n}`;
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...walk(rel));
    else out.push(rel);
  }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith("trace-imports.mjs")) {
  const entries = process.argv.slice(2).flatMap((e) => (statSync(join(ROOT, e)).isDirectory() ? walk(e) : [e]));
  const { files, missing } = trace(entries.filter((f) => /\.(tsx?|css)$/.test(f)));
  console.log(files.join("\n"));
  if (missing.length) console.error("MISSING:\n" + missing.join("\n"));
}
