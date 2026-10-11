// registry.ts — يولّد src/stores/registry.generated.ts من مجلدات stores/<slug>/ (يعمل قبل dev وbuild تلقائياً).
//
//   npx tsx scripts/stores/registry.ts           يكتب السجل
//   npx tsx scripts/stores/registry.ts --check   يفشل إن كان السجل المرفوع لا يطابق المجلدات (CI)
//
// ما يُقرأ من كل متجر (كله اختياري عدا store.json):
//   store.json              { "slug": "<اسم المجلد = النطاق الفرعي>", "name": "..." }
//   theme.css               جلد المتجر (يُحقن بعد تصميم النواة)
//   sections/<type>.tsx     يستبدل قسم النواة من نفس النوع
//   blocks/<name>.tsx       مكوّن جديد يوضع في الصفحة بقسم { type: "store_block", name }
//   slots/Header.tsx | Footer.tsx | Home.tsx
//   pages/<name>.tsx        صفحة جديدة على /<name> (ومجلدات فرعية: pages/a/b.tsx = /a/b)
//   blueprint.json          الواجهة والأقسام والنصوص (تُفحص بمخطط النواة، وكل store_block فيها يجب أن يكون له ملف)
//   seed.json               الأقسام والمنتجات الأولى (src/stores/seed.ts)
// أي ملف في هذه المجلدات لا يطابق القواعد يوقف التوليد برسالة واضحة، فلا يصل خطأ تسمية إلى الإنتاج صامتاً.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { z } from "zod";
import { blueprintSchema, sectionSchema } from "../../src/blueprint/schema";
import { storeSeedSchema } from "../../src/stores/seed";

const ROOT = process.cwd();
const STORES_DIR = join(ROOT, "stores");
const OUT = join(ROOT, "src/stores/registry.generated.ts");

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const NAME_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const SLOTS = ["Header", "Footer", "Home"] as const;
/** أول جزء من مسار صفحة خاصة لا يصطدم بصفحات النواة ولا بملفات النطاق. */
export const RESERVED_PAGE_ROOTS = new Set([
  "account", "admin", "c", "cart", "checkout", "frozen", "order", "p", "pages", "review", "search", "track",
  "api", "s", "_next", "robots.txt", "sitemap.xml", "manifest.webmanifest", "favicon.ico", "dashboard", "login",
]);
const SECTION_TYPES = new Set(
  (sectionSchema.options as unknown as { shape: { type: { value: string } } }[]).map((o) => o.shape.type.value).filter((t) => t !== "store_block"),
);

const storeJson = z.object({ slug: z.string().regex(SLUG_RE), name: z.string().min(1).max(80) }).passthrough();

type Found = { slug: string; name: string; theme: string; sections: [string, string][]; blocks: [string, string][]; slots: [string, string][]; pages: [string, string][] };

const errors: string[] = [];
const fail = (msg: string) => errors.push(msg);
const rel = (p: string) => relative(ROOT, p).split("\\").join("/");
const isDir = (p: string) => existsSync(p) && statSync(p).isDirectory();

function tsxFiles(dir: string): string[] {
  if (!isDir(dir)) return [];
  return readdirSync(dir).sort().flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return tsxFiles(p);
    if (!f.endsWith(".tsx")) {
      fail(`${rel(p)}: الملفات هنا مكوّنات .tsx فقط (ضع المساعدات في components/ أو lib/ داخل مجلد المتجر)`);
      return [];
    }
    return [p];
  });
}

/** مسار الاستيراد من src/stores/ إلى ملف داخل stores/ بلا الامتداد. */
const importPath = (file: string) => `../../${rel(file).replace(/\.tsx$/, "")}`;

function scanStore(slug: string): Found | null {
  const dir = join(STORES_DIR, slug);
  if (!SLUG_RE.test(slug)) {
    fail(`stores/${slug}: اسم المجلد يجب أن يكون النطاق الفرعي للمتجر (حروف إنجليزية صغيرة وأرقام وشرطة)`);
    return null;
  }
  const metaPath = join(dir, "store.json");
  if (!existsSync(metaPath)) {
    fail(`stores/${slug}: store.json مفقود`);
    return null;
  }
  let meta: z.infer<typeof storeJson>;
  try {
    const parsed = storeJson.safeParse(JSON.parse(readFileSync(metaPath, "utf8")));
    if (!parsed.success) {
      fail(`stores/${slug}/store.json: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("، ")}`);
      return null;
    }
    meta = parsed.data;
  } catch (e) {
    fail(`stores/${slug}/store.json: JSON غير صالح (${(e as Error).message})`);
    return null;
  }
  if (meta.slug !== slug) fail(`stores/${slug}/store.json: slug "${meta.slug}" لا يطابق اسم المجلد`);

  const themePath = join(dir, "theme.css");
  const theme = existsSync(themePath) ? readFileSync(themePath, "utf8") : "";
  if (/<\/style/i.test(theme)) fail(`stores/${slug}/theme.css: لا يحتوي </style>`);

  const sections: [string, string][] = [];
  for (const f of tsxFiles(join(dir, "sections"))) {
    const type = rel(f).split("/").pop()!.replace(/\.tsx$/, "");
    if (!SECTION_TYPES.has(type)) fail(`${rel(f)}: لا يوجد قسم نواة باسم "${type}" (الأنواع: ${[...SECTION_TYPES].join("، ")})`);
    else sections.push([type, importPath(f)]);
  }

  const blocks: [string, string][] = [];
  for (const f of tsxFiles(join(dir, "blocks"))) {
    const name = relative(join(dir, "blocks"), f).split("\\").join("/").replace(/\.tsx$/, "");
    if (!NAME_RE.test(name)) fail(`${rel(f)}: اسم المكوّن حروف إنجليزية صغيرة وأرقام وشرطة فقط، بلا مجلدات فرعية`);
    else blocks.push([name, importPath(f)]);
  }

  const slots: [string, string][] = [];
  for (const f of tsxFiles(join(dir, "slots"))) {
    const name = relative(join(dir, "slots"), f).replace(/\.tsx$/, "");
    if (!(SLOTS as readonly string[]).includes(name)) fail(`${rel(f)}: الأماكن المتاحة ${SLOTS.join(" و")} فقط`);
    else slots.push([name, importPath(f)]);
  }

  const pages: [string, string][] = [];
  for (const f of tsxFiles(join(dir, "pages"))) {
    const route = relative(join(dir, "pages"), f).split("\\").join("/").replace(/\.tsx$/, "");
    const parts = route.split("/");
    if (!parts.every((p) => NAME_RE.test(p))) fail(`${rel(f)}: أجزاء المسار حروف إنجليزية صغيرة وأرقام وشرطة فقط`);
    else if (RESERVED_PAGE_ROOTS.has(parts[0]!)) fail(`${rel(f)}: "/${parts[0]}" محجوز لصفحات النواة؛ اختر اسماً آخر`);
    else pages.push([route, importPath(f)]);
  }

  const issues = (label: string, list: { path: (string | number)[]; message: string }[]) =>
    list.slice(0, 8).forEach((i) => fail(`stores/${slug}/${label}: ${i.path.join(".") || "(الجذر)"} — ${i.message}`));
  const readJson = (file: string): unknown => {
    try {
      return JSON.parse(readFileSync(join(dir, file), "utf8"));
    } catch (e) {
      fail(`stores/${slug}/${file}: JSON غير صالح (${(e as Error).message})`);
      return undefined;
    }
  };
  if (existsSync(join(dir, "blueprint.json"))) {
    const raw = readJson("blueprint.json");
    if (raw !== undefined) {
      const bp = blueprintSchema.safeParse(raw);
      if (!bp.success) issues("blueprint.json", bp.error.issues);
      else {
        const known = new Set(blocks.map(([n]) => n));
        for (const s of [...bp.data.home]) {
          if (s.type === "store_block" && !known.has(s.name)) fail(`stores/${slug}/blueprint.json: القسم "${s.id}" يطلب المكوّن "${s.name}" ولا يوجد blocks/${s.name}.tsx`);
        }
      }
    }
  }
  if (existsSync(join(dir, "seed.json"))) {
    const raw = readJson("seed.json");
    if (raw !== undefined) {
      const seed = storeSeedSchema.safeParse(raw);
      if (!seed.success) issues("seed.json", seed.error.issues);
    }
  }

  return { slug, name: meta.name, theme, sections, blocks, slots, pages };
}

function render(stores: Found[]): string {
  const loaders = (pairs: [string, string][], indent: string) =>
    pairs.length
      ? `{\n${pairs.map(([k, p]) => `${indent}  ${JSON.stringify(k)}: () => import(${JSON.stringify(p)}),`).join("\n")}\n${indent}}`
      : "{}";
  const body = stores
    .map(
      (s) => `  ${JSON.stringify(s.slug)}: {
    meta: ${JSON.stringify({ slug: s.slug, name: s.name })},
    theme: ${JSON.stringify(s.theme)},
    sections: ${loaders(s.sections, "    ")},
    blocks: ${loaders(s.blocks, "    ")},
    slots: ${loaders(s.slots, "    ")},
    pages: ${loaders(s.pages, "    ")},
  },`,
    )
    .join("\n");
  return `// مولَّد من مجلدات stores/ بواسطة scripts/stores/registry.ts — لا تعدّله يدوياً.
// يُعاد توليده تلقائياً قبل dev وbuild، ويفحص CI أنه مطابق (npm run stores:check).
import type { StoreEntry } from "./types";

export const STORE_REGISTRY: Record<string, StoreEntry> = {${body ? `\n${body}\n` : ""}};
`;
}

export function generate(): { code: string; errors: string[] } {
  errors.length = 0;
  const slugs = isDir(STORES_DIR)
    ? readdirSync(STORES_DIR).filter((d) => !d.startsWith("_") && !d.startsWith(".") && isDir(join(STORES_DIR, d))).sort()
    : [];
  const found = slugs.map(scanStore).filter((s): s is Found => s !== null);
  return { code: render(found), errors: [...errors] };
}

const isMain = process.argv[1] && rel(process.argv[1]).replace(/\.ts$/, "") === "scripts/stores/registry";
if (isMain) {
  const { code, errors: errs } = generate();
  if (errs.length) {
    console.error(`✗ سجل المتاجر: ${errs.length} خطأ\n${errs.map((e) => `  - ${e}`).join("\n")}`);
    process.exit(1);
  }
  if (process.argv.includes("--check")) {
    const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
    if (current !== code) {
      console.error("✗ src/stores/registry.generated.ts لا يطابق مجلدات stores/. شغّل: npm run stores:registry");
      process.exit(1);
    }
    console.log("✓ سجل المتاجر مطابق");
  } else {
    writeFileSync(OUT, code);
    console.log(`✓ سجل المتاجر: ${OUT.slice(ROOT.length + 1)}`);
  }
}
