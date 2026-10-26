// build.ts — يجمع مشروع العميل المستقل كاملاً: الكود المتتبَّع + ملفات الـ overlay + الهوية المحقونة + الجذر والوثائق.
// خالص: يقرأ من SourceTree (قرص أو أرشيف GitHub) ويعيد قائمة ملفات. الكتابة (zip أو قرص) عند المستدعي.
import { blueprintSchema, type StoreBlueprint } from "@/blueprint/schema";
import type { SourceTree } from "./source";
import { traceProject, OVERLAY_DIR } from "./trace";
import { PATCHES } from "./patches";
import { blueprintFile, embedMigrations, migrationsModule, seedBlueprint, storeConfigFile } from "./inject";
import { projectPackageJson, type LockPackages, type PackageSource } from "./package-json";
import type { DeliveryIdentity, TemplateFile } from "./types";

const TEXT = /\.(ts|tsx|mjs|js|json|jsonc|md|css|yml|yaml|txt|sql|html|example|svg)$|^\.|\/\.[^/]+$/;
const DEFAULT_AGENCY_URL = "https://colapia.com/dashboard";

/** ملفات عامة تُنسخ كما هي إلى public/ (أصوات اللوحة وصفحة عدم الاتصال وفيديوهات الواجهة الجاهزة). */
const PUBLIC_FILES = ["public/offline.html", "public/sw.js"];
const PUBLIC_DIRS = ["public/sounds", "public/demo/media"];

const posixRel = (p: string) => p.split("\\").join("/");
/** `_dot_name` ← `.name` عند أي مستوى من المسار (git لا يحفظ بعض الملفات النقطية كما هي في القوالب). */
const undot = (p: string) => p.replace(/(^|\/)_dot_/g, "$1.");

export function fillPlaceholders(text: string, id: DeliveryIdentity, agencyUrl: string): string {
  return text
    .replaceAll("{{STORE_NAME}}", id.storeName)
    .replaceAll("{{SLUG}}", id.slug)
    .replaceAll("{{OWNER_EMAIL}}", id.ownerEmail.trim().toLowerCase())
    .replaceAll("{{REQUEST_CODE}}", id.requestCode ?? "")
    .replaceAll("{{AGENCY_URL}}", agencyUrl)
    .replaceAll("{{GENERATED_AT}}", (id.generatedAt ?? new Date().toISOString()).slice(0, 10));
}

/** سجل المشروع: مدخل المتجر المخصص وحده مقتطعاً من سجل المنصة المولَّد (الأسطر ثابتة البنية في scripts/stores/registry.ts). */
export async function registryFor(src: SourceTree, folder: string): Promise<string> {
  const text = await src.read("src/stores/registry.generated.ts");
  const head = `\n  ${JSON.stringify(folder)}: {`;
  const a = text.indexOf(head);
  if (a < 0) throw new Error(`stores/${folder} غير مسجَّل في src/stores/registry.generated.ts: شغّلوا npm run stores:registry`);
  const b = text.indexOf("\n  },\n", a);
  if (b < 0) throw new Error("بنية سجل المتاجر تغيّرت");
  return `// مولَّد عند التسليم: سجل مجلد المتجر المخصص stores/${folder}/ (لا تعدّلوه يدوياً؛ أضيفوا القسم أو المكوّن في المجلد نفسه).
import type { StoreEntry } from "./types";

export const STORE_REGISTRY: Record<string, StoreEntry> = {${text.slice(a, b)}\n  },\n};\n`;
}

export type BuildResult = { files: TemplateFile[]; missing: string[]; packages: string[] };

export async function buildDeliveryProject(src: SourceTree, id: DeliveryIdentity, opts: { agencyUrl?: string; allowMissingMigrations?: boolean } = {}): Promise<BuildResult> {
  const agencyUrl = opts.agencyUrl ?? DEFAULT_AGENCY_URL;
  const folder = id.storeFolder && /^[a-z0-9][a-z0-9-]*$/.test(id.storeFolder) && src.isFile(`stores/${id.storeFolder}/store.json`) ? id.storeFolder : null;
  if (folder && id.slug !== folder) throw new Error(`معرّف المشروع (${id.slug}) يجب أن يطابق مجلد المتجر (${folder}): السجل يبحث بالمعرّف`);
  const virtual = new Map<string, string>();
  if (folder) virtual.set("src/stores/registry.generated.ts", await registryFor(src, folder));
  const { files, packages, missing, overlay } = await traceProject(src, { patches: PATCHES, virtual });
  const out: TemplateFile[] = [];
  const seen = new Set<string>();
  const push = (path: string, data: string | Uint8Array) => {
    const p = posixRel(path);
    if (seen.has(p)) throw new Error(`ملف مكرر في المشروع: ${p}`);
    seen.add(p);
    out.push({ path: p, data });
  };

  for (const [path, code] of files) {
    if (path === "src/store.config.ts" || path === "src/db/migrations.generated.ts") continue;
    push(path, code.includes("{{") ? fillPlaceholders(code, id, agencyUrl) : code);
  }

  // مجلد المتجر المخصص: ما تحتاجه الأقسام والمكوّنات يُتتبَّع بالاستيراد، ونضيف ملفات البيانات والوصفة صراحةً.
  let bpOverride: StoreBlueprint | null = null;
  if (folder) {
    for (const n of ["store.json", "theme.css", "blueprint.json", "seed.json", "setup-recipe.json"]) {
      const p = `stores/${folder}/${n}`;
      if (src.isFile(p) && !seen.has(p)) push(p, await src.readBytes(p));
    }
    if (src.isFile(`stores/${folder}/blueprint.json`)) bpOverride = blueprintSchema.parse(JSON.parse(await src.read(`stores/${folder}/blueprint.json`)));
  }

  // الهوية والتصميم الأول وmigrations المضمَّنة.
  push("src/store.config.ts", storeConfigFile(id, agencyUrl));
  push("store/blueprint.json", blueprintFile(bpOverride ?? seedBlueprint(id)));

  // migrations: مجلد drizzle/ كما هو (لمن يشغّل drizzle-kit) + نسخة مضمَّنة لصفحة /setup.
  const drizzleDir = `${OVERLAY_DIR}/drizzle`;
  const drizzleFiles = await src.list(drizzleDir);
  const sqlByTag: Record<string, string> = {};
  for (const f of drizzleFiles) {
    const rel = f.slice(drizzleDir.length + 1);
    push(`drizzle/${rel}`, await src.readBytes(f));
    if (/^[^/]+\.sql$/.test(rel)) sqlByTag[rel.replace(/\.sql$/, "")] = await src.read(f);
  }
  const journal = `${drizzleDir}/meta/_journal.json`;
  if (!src.isFile(journal) && !opts.allowMissingMigrations) throw new Error("delivery/overlay/drizzle غير مولَّد: شغّلوا npm run delivery:migrations");
  const journalText = src.isFile(journal) ? await src.read(journal) : JSON.stringify({ entries: [] });
  push("src/db/migrations.generated.ts", migrationsModule(embedMigrations(journalText, sqlByTag)));

  // ملفات الجذر والوثائق (قوالب بعناصر نائبة).
  for (const dir of ["root", "docs"] as const) {
    const base = `${OVERLAY_DIR}/${dir}/`;
    for (const f of await src.list(`${OVERLAY_DIR}/${dir}`)) {
      const rel = undot(f.slice(base.length));
      const target = dir === "root" ? rel : `docs/${rel}`;
      if (TEXT.test(target)) push(target, fillPlaceholders(await src.read(f), id, agencyUrl));
      else push(target, await src.readBytes(f));
    }
  }

  // ملفات عامة.
  for (const f of PUBLIC_FILES) if (src.isFile(f)) push(f, await src.readBytes(f));
  for (const d of PUBLIC_DIRS) for (const f of await src.list(d)) push(f, await src.readBytes(f));

  // package.json بإصدارات المنصة المثبّتة.
  const platform = JSON.parse(await src.read("package.json")) as PackageSource;
  const lock = src.isFile("package-lock.json")
    ? (((JSON.parse(await src.read("package-lock.json")) as { packages?: LockPackages }).packages ?? {}) as LockPackages)
    : {};
  push("package.json", projectPackageJson({ slug: id.slug, packages, platform, lock, installed: (n) => src.installedVersion(n) }));

  out.sort((a, b) => a.path.localeCompare(b.path));
  return { files: out, missing, packages: [...packages].sort() };
}
