// template.ts — يولّد "مشروع التاجر الخاص": المتجر + لوحة التحكم فقط، محقوناً ببيانات متجره.
//
// المبدأ: لا يُكتب كود جديد لكل تاجر. نفس مكونات المنصة (المتجر واللوحة) تُجمع بتتبع شجرة
// الاستيراد من صفحات المتجر واللوحة وحدها، فلا يدخل المشروع أي ملف لا تحتاجه (لا البناء بالذكاء
// الاصطناعي، ولا البوت، ولا لوحة المنصة، ولا الدفع للمنصة). ما يختلف في نسخة المتجر الواحد
// يأتي من template/src (يحل محل الملف المقابل)، وما يخص التاجر يُحقن في ملفات مولّدة:
// إعداد المتجر، وخطوطه، وألوانه، ونسخة من تصميمه.
//
// يُستخدم من: GitHub (إنشاء مستودع التاجر)، وتحميل ZIP، وسكربت الفحص scripts/store-template.ts
// الذي يولّد المشروع في مجلد ويشغّل عليه فحص الأنواع والبناء.
import { readFile, readdir, stat } from "node:fs/promises";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import type { StoreBlueprint } from "@/blueprint/schema";

export const TEMPLATE_DIR = "template";

/** نقاط الدخول: صفحات المتجر واللوحة ومساراتهما العامة. كل ما عداها يُستبعد تلقائياً. */
const ENTRY_DIRS = ["src/app/s/[store]", "src/app/(platform)/dashboard"];
const ENTRY_FILES = [
  "src/app/layout.tsx",
  "src/app/globals.css",
  "src/app/error.tsx",
  "src/app/global-error.tsx",
  "src/app/not-found.tsx",
  "src/app/loading.tsx",
  "src/app/api/track/route.ts",
  "src/app/api/proof/route.ts",
  "src/app/api/live/route.ts",
  "src/app/api/storefront/icon/route.ts",
  "src/app/api/dashboard/analytics/export/route.ts",
  "src/app/api/dashboard/orders/export/route.ts",
  "src/app/api/dashboard/customers/export/route.ts",
  "src/app/api/dashboard/attention/route.ts",
  "src/app/api/dashboard/search/route.ts",
  "src/app/api/storefront/variants/route.ts",
  "src/app/api/storefront/my-orders/route.ts",
  "src/app/print/invoices/page.tsx",
  "src/app/api/uploadthing/route.ts",
  "src/app/robots.ts",
  "src/app/sitemap.ts",
  "src/app/manifest.webmanifest/route.ts",
];
/** صفحات تخص المنصة داخل مجلدات الدخول. */
const EXCLUDED_ENTRIES = [
  /^src\/app\/s\/\[store\]\/(admin|account|frozen)\//,
  /^src\/app\/\(platform\)\/dashboard\/(billing|onboarding|store|growth|own|design)\//,
];
/** حارس: لو وصل التتبع لأي من هذه فهناك استيراد منصة تسرب للمتجر، فيفشل التوليد بدل أن يتسرب. */
export const FORBIDDEN_IN_TEMPLATE = [
  /^src\/ai\/build\//,
  /^src\/ai\/agents\//,
  /^src\/ai\/lifecycle\//,
  /^src\/ai\/providers\.ts$/,
  /^src\/lifecycle\//,
  /^src\/channels\//,
  /^src\/server\/ownership\//,
  /^src\/server\/actions\/(platform|platform-|onboarding|referral)/,
  /^src\/app\/\(platform\)\/(\(dash\)|admin|onboarding|design-lab|signup|claim)\//,
  /^src\/app\/api\/(workflows|agents|webhooks|ops|jobs|onboarding|ownership|store-export|pusher)\//,
  /^src\/components\/(landing|platform|growth)\//,
  /^src\/onboarding\/(?!schema\.ts$)/,
];

const CODE_EXT = [".ts", ".tsx", ".mjs", ".js", ".css"];
const IMPORT_RE =
  /(?:import|export)\s[^'"]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s+["']([^"']+)["']|@import\s+["']([^"']+)["']/g;

export type StoreInjection = {
  storeName: string;
  subdomain: string;
  blueprint: StoreBlueprint;
  /** عنوان المنصة التي يُسحب منها المتجر عند الإعداد الأول (لا يحمل أي سر). */
  platformOrigin: string;
};

export type TemplateFile = { path: string; data: string | Uint8Array };

const posixRel = (p: string) => p.split("\\").join("/");

async function walk(root: string, dir: string): Promise<string[]> {
  if (!existsSync(join(root, dir))) return [];
  const out: string[] = [];
  for (const name of await readdir(join(root, dir))) {
    const rel = `${dir}/${name}`;
    if ((await stat(join(root, rel))).isDirectory()) out.push(...(await walk(root, rel)));
    else out.push(rel);
  }
  return out;
}

/** يحل مسار استيراد إلى ملف داخل المشروع (مع اعتبار ملفات القالب)، أو null لحزمة خارجية. */
function resolveSpec(root: string, from: string, spec: string, overlay: Set<string>): string | null | undefined {
  let base: string;
  if (spec.startsWith("@/")) base = `src/${spec.slice(2)}`;
  else if (spec.startsWith(".")) base = posix.normalize(posix.join(posix.dirname(from), spec));
  else return null;
  const cands = [base, ...CODE_EXT.map((e) => base + e), ...CODE_EXT.map((e) => `${base}/index${e}`)];
  for (const c of cands) {
    if (overlay.has(c)) return c;
    const abs = join(root, c);
    if (existsSync(abs) && statSync(abs).isFile()) return c;
  }
  return undefined;
}

export function importSpecs(code: string): string[] {
  const out: string[] = [];
  for (const m of code.matchAll(IMPORT_RE)) {
    const s = m[1] ?? m[2] ?? m[3] ?? m[4];
    if (s) out.push(s);
  }
  return out;
}

/** اسم الحزمة من مسار استيراد خارجي: "@scope/pkg/sub" → "@scope/pkg". */
export function packageOf(spec: string): string | null {
  if (spec.startsWith(".") || spec.startsWith("@/") || spec.startsWith("node:") || spec.startsWith("next/font")) return null;
  const parts = spec.split("/");
  return spec.startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0]!;
}

export type TraceResult = { files: Map<string, string>; packages: Set<string>; missing: string[] };

/** يجمع ملفات مشروع التاجر: التتبع يبدأ من صفحات المتجر واللوحة وملفات القالب الخاصة. */
export async function traceStoreProject(root: string): Promise<TraceResult> {
  const overlayFiles = (await walk(root, `${TEMPLATE_DIR}/src`)).map((f) => f.slice(TEMPLATE_DIR.length + 1));
  const overlay = new Set(overlayFiles);
  const read = async (f: string) =>
    overlay.has(f) ? readFile(join(root, TEMPLATE_DIR, f), "utf8") : readFile(join(root, f), "utf8");

  const entryDirFiles = (await Promise.all(ENTRY_DIRS.map((d) => walk(root, d)))).flat();
  const entries = [...entryDirFiles, ...ENTRY_FILES, ...overlayFiles]
    .filter((f) => CODE_EXT.some((e) => f.endsWith(e)))
    .filter((f) => !EXCLUDED_ENTRIES.some((re) => re.test(f)));

  const files = new Map<string, string>();
  const packages = new Set<string>();
  const missing: string[] = [];
  const stack = [...new Set(entries)];
  while (stack.length) {
    const f = stack.pop()!;
    if (files.has(f)) continue;
    const code = await read(f);
    files.set(f, code);
    for (const spec of importSpecs(code)) {
      const r = resolveSpec(root, f, spec, overlay);
      if (r === null) {
        const pkg = packageOf(spec);
        if (pkg) packages.add(pkg);
      } else if (r === undefined) missing.push(`${f} → ${spec}`);
      else if (!files.has(r)) stack.push(r);
    }
  }

  const leaked = [...files.keys()].filter((f) => !overlay.has(f) && FORBIDDEN_IN_TEMPLATE.some((re) => re.test(f)));
  if (leaked.length) throw new Error(`ملفات منصة تسربت إلى مشروع المتجر:\n${leaked.join("\n")}`);
  return { files, packages, missing };
}

// ─── الملفات المحقونة ببيانات المتجر ──────────────────────────────────────────

const FONT_EXPORTS: Record<string, { exp: string; family: string; cssVar: string }> = {
  cairo: { exp: "fontCairo", family: "Cairo", cssVar: "--font-cairo" },
  tajawal: { exp: "fontTajawal", family: "Tajawal", cssVar: "--font-tajawal" },
  ibm_plex_arabic: { exp: "fontIbm", family: "IBM_Plex_Sans_Arabic", cssVar: "--font-ibm-plex-arabic" },
  almarai: { exp: "fontAlmarai", family: "Almarai", cssVar: "--font-almarai" },
  changa: { exp: "fontChanga", family: "Changa", cssVar: "--font-changa" },
  el_messiri: { exp: "fontMessiri", family: "El_Messiri", cssVar: "--font-el-messiri" },
  readex_pro: { exp: "fontReadex", family: "Readex_Pro", cssVar: "--font-readex-pro" },
  noto_kufi: { exp: "fontKufi", family: "Noto_Kufi_Arabic", cssVar: "--font-noto-kufi" },
};

const json = (v: unknown) => JSON.stringify(v, null, 2);

/** إعداد المتجر: هويته وعنوان المنصة للاستلام الأول. لا يحمل أي مفتاح. */
export function storeConfigFile(inj: StoreInjection): string {
  return `// store.config.ts — هوية متجرك (مولّد من Colapia عند استلام متجرك).
// لا يحتوي أي مفتاح سري؛ مفاتيحك تُحفظ في قاعدة بياناتك أنت من لوحة التحكم.
export const STORE = {
  name: ${JSON.stringify(inj.storeName)},
  subdomain: ${JSON.stringify(inj.subdomain)},
  /** المنصة التي استُلم منها المتجر (للاستلام الأول فقط من صفحة /setup). */
  importFrom: ${JSON.stringify(inj.platformOrigin)},
  generatedAt: ${JSON.stringify(new Date().toISOString())},
} as const;
`;
}

/** الخطوط: نسخة المتجر تحمّل خطوط متجره فقط بدل كل خطوط المنصة (أخف وأسرع). */
export function storeFontsFile(bp: StoreBlueprint): string {
  const wanted = new Set<string>(["cairo"]);
  const fonts = bp.theme.fonts as unknown as Record<string, unknown>;
  for (const v of Object.values(fonts ?? {})) if (typeof v === "string" && FONT_EXPORTS[v]) wanted.add(v);
  const list = [...wanted].map((k) => FONT_EXPORTS[k]!);
  const families = [...new Set(list.map((f) => f.family))];
  const opts: Record<string, string> = {
    Cairo: `{ subsets: ["arabic", "latin"], variable: "--font-cairo", display: "swap" }`,
    Tajawal: `{ subsets: ["arabic", "latin"], weight: ["400", "500", "700", "800"], variable: "--font-tajawal", display: "swap" }`,
    IBM_Plex_Sans_Arabic: `{ subsets: ["arabic", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-ibm-plex-arabic", display: "swap" }`,
    Almarai: `{ subsets: ["arabic"], weight: ["300", "400", "700", "800"], variable: "--font-almarai", display: "swap" }`,
    Changa: `{ subsets: ["arabic", "latin"], variable: "--font-changa", display: "swap" }`,
    El_Messiri: `{ subsets: ["arabic", "latin"], variable: "--font-el-messiri", display: "swap" }`,
    Readex_Pro: `{ subsets: ["arabic", "latin"], variable: "--font-readex-pro", display: "swap" }`,
    Noto_Kufi_Arabic: `{ subsets: ["arabic"], variable: "--font-noto-kufi", display: "swap" }`,
  };
  return [
    "// fonts.ts — خطوط متجرك فقط (مولّد من تصميم متجرك).",
    `import { ${families.join(", ")} } from "next/font/google";`,
    "",
    ...list.map((f) => `export const ${f.exp} = ${f.family}(${opts[f.family]});`),
    "",
    `export const fontVariables = [${list.map((f) => f.exp).join(", ")}].map((f) => f.variable).join(" ");`,
    "",
  ].join("\n");
}

/** ألوان المتجر كمتغيرات CSS ثابتة: الصفحة الأولى تُرسم بألوان المتجر قبل أي قراءة من القاعدة. */
export function storeThemeCss(bp: StoreBlueprint): string {
  const p = bp.theme.palette as unknown as Record<string, string>;
  const vars = Object.entries(p)
    .filter(([, v]) => typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v))
    .map(([k, v]) => `  --store-${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}: ${v};`);
  return `/* store-theme.css — ألوان متجرك (مولّد من تصميمه). التصميم الحي يُقرأ من قاعدتك ويمكن تعديله من اللوحة. */\n:root {\n${vars.join("\n")}\n}\n`;
}

// ─── package.json ────────────────────────────────────────────────────────────

/** حزم لا تظهر في الاستيراد لكنها لازمة للبناء. */
const BUILD_PACKAGES = ["next", "react", "react-dom", "tailwindcss", "@tailwindcss/postcss", "drizzle-orm", "@neondatabase/serverless"];
const DEV_PACKAGES = ["typescript", "@types/node", "@types/react", "@types/react-dom"];

export function storePackageJson(
  subdomain: string,
  packages: Set<string>,
  platformPkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> },
  installed: (name: string) => string | null
): string {
  const all = { ...platformPkg.devDependencies, ...platformPkg.dependencies };
  // الإصدار المثبّت فعلاً على المنصة (المختبر) يُثبَّت كما هو، حتى يُبنى مشروع التاجر بنفس الإصدارات.
  // بلا إصدار مثبّت نبقي النطاق كما هو (^x.y.z) ليحل npm أحدث إصدار متوافق، لا أقدمه.
  const version = (name: string) => installed(name) ?? all[name] ?? null;
  const deps: Record<string, string> = {};
  for (const name of [...packages, ...BUILD_PACKAGES].sort()) {
    if (DEV_PACKAGES.includes(name)) continue;
    const v = version(name);
    if (v) deps[name] = v;
  }
  const dev: Record<string, string> = {};
  // أنواع الحزم المستخدمة (مثل @types/qrcode) تلزم فحص الأنواع أثناء البناء.
  const typings = Object.keys(deps)
    .map((n) => `@types/${n.startsWith("@") ? n.slice(1).replace("/", "__") : n}`)
    .filter((t) => all[t]);
  for (const name of [...DEV_PACKAGES, ...typings]) {
    const v = version(name);
    if (v) dev[name] = v;
  }
  return json({
    name: `${subdomain}-store`,
    private: true,
    version: "1.0.0",
    scripts: { dev: "next dev", build: "next build", start: "next start", typecheck: "tsc --noEmit" },
    engines: { node: ">=20" },
    dependencies: deps,
    devDependencies: dev,
  }) + "\n";
}

// ─── التجميع ─────────────────────────────────────────────────────────────────

const ROOT_SKELETON = "root";
const INJECTED = new Set(["src/lib/fonts.ts", "src/store.config.ts", "src/app/store-theme.css"]);

/** ملفات هوية المتجر المحقونة (اسمه وخطوطه وألوانه وتصميمه): التحديث اللاحق للكود لا يلمسها. */
export const STORE_IDENTITY_FILES = ["src/lib/fonts.ts", "src/store.config.ts", "src/app/store-theme.css", "store/blueprint.json"] as const;

export async function buildStoreProject(root: string, inj: StoreInjection): Promise<{ files: TemplateFile[]; missing: string[] }> {
  const { files, packages, missing } = await traceStoreProject(root);
  const out: TemplateFile[] = [];

  for (const [path, code] of files) {
    // ملفات تُستبدل بنسخ محقونة ببيانات المتجر (في template/src نسخ تجريبية لفحص الأنواع فقط).
    if (INJECTED.has(path)) continue;
    out.push({ path, data: code });
  }
  out.push({ path: "src/lib/fonts.ts", data: storeFontsFile(inj.blueprint) });
  out.push({ path: "src/store.config.ts", data: storeConfigFile(inj) });
  out.push({ path: "src/app/store-theme.css", data: storeThemeCss(inj.blueprint) });
  out.push({ path: "store/blueprint.json", data: json(inj.blueprint) + "\n" });

  // ملفات الجذر (tsconfig، next.config، vercel.json، README...) ومخطط قاعدة المتجر.
  for (const f of await walk(root, `${TEMPLATE_DIR}/${ROOT_SKELETON}`)) {
    const rel = f.slice(`${TEMPLATE_DIR}/${ROOT_SKELETON}/`.length).replace(/(^|\/)_dot_/g, "$1.");
    const raw = await readFile(join(root, f), "utf8");
    out.push({ path: rel, data: raw.replaceAll("{{STORE_NAME}}", inj.storeName).replaceAll("{{SUBDOMAIN}}", inj.subdomain) });
  }
  for (const f of await walk(root, `${TEMPLATE_DIR}/drizzle`)) {
    out.push({ path: f.slice(TEMPLATE_DIR.length + 1), data: await readFile(join(root, f)) });
  }
  for (const f of ["postcss.config.mjs", "next-env.d.ts"]) {
    if (existsSync(join(root, f))) out.push({ path: f, data: await readFile(join(root, f), "utf8") });
  }
  for (const f of [...(await walk(root, "public/sounds")), "public/logo.png"]) {
    if (existsSync(join(root, f))) out.push({ path: f, data: await readFile(join(root, f)) });
  }

  const platformPkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  // مصدر الإصدارات: package-lock.json (مرفق مع الدالة على Vercel)، ثم node_modules محلياً.
  // بدونهما كان النطاق يُقطع إلى أقل إصدار (zod 3.24.0 مثلاً) فيفشل npm install عند التاجر بتعارض peer.
  const lock = existsSync(join(root, "package-lock.json"))
    ? ((JSON.parse(await readFile(join(root, "package-lock.json"), "utf8")) as { packages?: Record<string, { version?: string }> }).packages ?? {})
    : {};
  const installed = (name: string) => {
    const locked = lock[`node_modules/${name}`]?.version;
    if (locked) return locked;
    for (const base of [join(root, "node_modules"), join(dirname(root), "node_modules")]) {
      const p = join(base, name, "package.json");
      if (existsSync(p)) {
        try {
          return (JSON.parse(readFileSync(p, "utf8")) as { version?: string }).version ?? null;
        } catch {
          return null;
        }
      }
    }
    return null;
  };
  // الاعتماديات الندية الإلزامية (مثل three لـ model-viewer) تُضاف بإصدار المنصة نفسه، فيكون التثبيت حتمياً.
  const pkgJson = JSON.parse(storePackageJson(inj.subdomain, packages, platformPkg, installed)) as { dependencies: Record<string, string> };
  const lockMeta = lock as Record<string, { version?: string; peerDependencies?: Record<string, string>; peerDependenciesMeta?: Record<string, { optional?: boolean }> }>;
  for (const name of Object.keys(pkgJson.dependencies)) {
    const meta = lockMeta[`node_modules/${name}`];
    for (const peer of Object.keys(meta?.peerDependencies ?? {})) {
      if (meta?.peerDependenciesMeta?.[peer]?.optional || pkgJson.dependencies[peer]) continue;
      const v = installed(peer);
      if (v) pkgJson.dependencies[peer] = v;
    }
  }
  pkgJson.dependencies = Object.fromEntries(Object.entries(pkgJson.dependencies).sort(([a], [b]) => a.localeCompare(b)));
  out.push({ path: "package.json", data: json(pkgJson) + "\n" });

  return { files: out.map((f) => ({ ...f, path: posixRel(f.path) })), missing };
}
