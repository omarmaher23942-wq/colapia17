// trace.ts — يجمع ملفات مشروع العميل بتتبع شجرة الاستيراد من صفحات المتجر واللوحة والإعداد وحدها.
//
// المبدأ: لا يُكتب كود جديد لكل عميل. نفس مكوّنات المنصة (المتجر واللوحة ومسار الإعداد) تُجمع بتتبع الاستيراد، فلا يدخل
// المشروع أي ملف لا تحتاجه (لا الوكيل، ولا لوحة الفريق، ولا الفوترة). ما يختلف في مشروع العميل الواحد يأتي من
// delivery/overlay/src (ملف بنفس المسار يحل محل ملف المنصة، وملف بمسار جديد يُضاف)، ومن patches.ts (تعديلات نصية دقيقة
// تفشل بصخب لو تغيّر الأصل). خالص: يقرأ من SourceTree فقط (القرص أو أرشيف GitHub).
import { posix } from "node:path";
import type { SourceTree } from "./source";
import { applyPatches, type Patch } from "./patches";

export const OVERLAY_DIR = "delivery/overlay";

/** نقاط الدخول: صفحات المتجر واللوحة ومسار الإعداد ومساراتها العامة. كل ما عداها يُستبعد تلقائياً. */
export const ENTRY_DIRS = ["src/app/s/[store]", "src/app/(platform)/dashboard"];
export const ENTRY_FILES = [
  "src/app/(platform)/onboarding/page.tsx",
  "src/app/globals.css",
  "src/app/error.tsx",
  "src/app/global-error.tsx",
  "src/app/not-found.tsx",
  "src/app/robots.ts",
  "src/app/sitemap.ts",
  "src/app/manifest.webmanifest/route.ts",
  "src/app/print/invoices/page.tsx",
  "src/app/print/labels/page.tsx",
  "src/app/print/poster/page.tsx",
  "src/app/api/track/route.ts",
  "src/app/api/proof/route.ts",
  "src/app/api/live/route.ts",
  "src/app/api/upload/route.ts",
  "src/app/api/storefront/icon/route.ts",
  "src/app/api/storefront/variants/route.ts",
  "src/app/api/storefront/my-orders/route.ts",
  "src/app/api/storefront/wishlist/route.ts",
  "src/app/api/storefront/suggest/route.ts",
  "src/app/api/storefront/cart-check/route.ts",
  "src/app/api/storefront/visual-search/route.ts",
  "src/app/api/dashboard/analytics/export/route.ts",
  "src/app/api/dashboard/orders/export/route.ts",
  "src/app/api/dashboard/customers/export/route.ts",
  "src/app/api/dashboard/attention/route.ts",
  "src/app/api/dashboard/search/route.ts",
  "src/app/api/setup/import/route.ts",
];

/** صفحات تخص المنصة داخل مجلدات الدخول: لا تدخل مشروع العميل. */
export const EXCLUDED_ENTRIES = [
  /^src\/app\/s\/\[store\]\/(admin|account|frozen)\//,
  /^src\/app\/\(platform\)\/dashboard\/(billing|activate|domain|requests|team|usage|setup-pending|store|preview|edit|history)\//,
];

/**
 * حارس: لو وصل التتبع لأي من هذه فهناك استيراد منصة تسرّب إلى مشروع العميل، فيفشل التوليد بدل أن يتسرب.
 * (ملفات الـ overlay مستثناة دائماً: هي نسخ العميل المقصودة.)
 */
export const FORBIDDEN_IN_PROJECT = [
  /^src\/agent\//,
  /^src\/agency\//,
  /^src\/golden\//,
  /^src\/delivery\//,
  /^src\/ai\/agents\//,
  /^src\/ai\/lifecycle\//,
  /^src\/ai\/build\//,
  /^src\/channels\//,
  /^src\/lifecycle\//,
  /^src\/components\/(landing|platform|growth|intake|brand)\//,
  /^src\/onboarding\/(?!schema\.ts$)/,
  /^src\/app\/\(platform\)\/(\(dash\)|\(auth\)|admin|design-lab|signup|claim|login|setup|no-store|data-deletion|privacy|terms|page\.tsx)/,
  /^src\/app\/api\/(agents|webhooks|ops|jobs|outreach|pusher|auth|email)\//,
  /^src\/db\/schema\/(agency|agency-constants|ai|lifecycle|onboarding|outreach|members|support|platform)\.ts$/,
  /^src\/db\/planes\.ts$/,
  /^src\/server\/(platform-guard|platform-|login-code|google-oauth|oauth-state|domains|hosting-grace|qstash-verify|cron-auth|launch-checks|store-purge|store-purge-plan|subdomain-apply|subdomain-hold|claims|monthly-report|outreach|r2)(\.ts|\/)/,
  /^src\/server\/pricing\.ts$/,
  /^src\/server\/actions\/(platform|agency|change-requests|custom-domain|store-team|merchant-login|connections|subdomain|launch|billing|onboarding-agent)/,
  /^src\/components\/dashboard\/(requests|domain|team|billing|activate)\//,
  /^src\/lib\/(hosting|platform-pricing|usage-limits|trial-countdown|billing-stage|bot-outbound|meta-trace|subdomain-change|custom-domain|change-requests|landing-pricing|sales-funnel)\.ts$/,
];

/** ملفات يولّدها المسلِّم نفسه (ليست في المنصة ولا في الـ overlay): تُعدّ موجودة عند حل الاستيراد. */
export const GENERATED_FILES = new Set(["src/store.config.ts", "src/db/migrations.generated.ts", "store/blueprint.json"]);

export const CODE_EXT = [".ts", ".tsx", ".mjs", ".js", ".css"];
const IMPORT_RE =
  /(?:import|export)\s[^'"]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s+["']([^"']+)["']|@import\s+["']([^"']+)["']/g;

export function importSpecs(code: string): string[] {
  const out: string[] = [];
  for (const m of code.matchAll(IMPORT_RE)) {
    const s = m[1] ?? m[2] ?? m[3] ?? m[4];
    if (s) out.push(s);
  }
  return out;
}

/** اسم الحزمة من مسار استيراد خارجي: "@scope/pkg/sub" ← "@scope/pkg". */
export function packageOf(spec: string): string | null {
  if (spec.startsWith(".") || spec.startsWith("@/") || spec.startsWith("node:") || spec === "cn") return null;
  const parts = spec.split("/");
  return spec.startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0]!;
}

export type TraceResult = {
  /** مسار الملف في المشروع ← محتواه (بعد الـ overlay والتعديلات النصية). */
  files: Map<string, string>;
  packages: Set<string>;
  /** استيرادات محلية لم تُحل (تعني مشروعاً لن يُبنى). */
  missing: string[];
  /** ملفات الـ overlay التي استُخدمت (للاختبارات). */
  overlay: Set<string>;
};

/** مسارات الـ overlay تحت src (مسار المشروع ← مسار الملف في المصدر). */
export async function overlayFiles(src: SourceTree): Promise<Map<string, string>> {
  const prefix = `${OVERLAY_DIR}/src/`;
  const all = await src.list(`${OVERLAY_DIR}/src`);
  return new Map(all.map((f) => [`src/${f.slice(prefix.length)}`, f]));
}

export async function traceProject(src: SourceTree, opts: { patches?: Patch[]; extraEntries?: string[]; virtual?: Map<string, string> } = {}): Promise<TraceResult> {
  const overlay = await overlayFiles(src);
  // ملفات مولَّدة وقت التوليد بمحتواها (مثل سجل متجر العميل): تتقدم على الـ overlay وتُعامل مثله.
  for (const k of opts.virtual?.keys() ?? []) overlay.set(k, k);
  const patches = opts.patches;
  const read = async (f: string) => {
    const v = opts.virtual?.get(f);
    if (v !== undefined) return v;
    const o = overlay.get(f);
    if (o) return src.read(o);
    return applyPatches(f, await src.read(f), patches);
  };
  const exists = (p: string) => overlay.has(p) || src.isFile(p) || GENERATED_FILES.has(p);

  const resolveSpec = (from: string, spec: string): string | null | undefined => {
    let base: string;
    if (spec === "cn") base = "src/cn";
    else if (spec.startsWith("@/")) base = `src/${spec.slice(2)}`;
    else if (spec.startsWith(".")) base = posix.normalize(posix.join(posix.dirname(from), spec));
    else return null;
    const cands = [base, ...CODE_EXT.map((e) => base + e), ...CODE_EXT.map((e) => `${base}/index${e}`)];
    for (const c of cands) if (exists(c)) return c;
    return undefined;
  };

  const entryDirFiles = (await Promise.all(ENTRY_DIRS.map((d) => src.list(d)))).flat();
  const entries = [...entryDirFiles, ...ENTRY_FILES.filter(exists), ...overlay.keys(), ...(opts.extraEntries ?? [])]
    .filter((f) => CODE_EXT.some((e) => f.endsWith(e)))
    .filter((f) => overlay.has(f) || !EXCLUDED_ENTRIES.some((re) => re.test(f)));

  const files = new Map<string, string>();
  const packages = new Set<string>();
  const missing: string[] = [];
  const stack = [...new Set(entries)];
  const parent = new Map<string, string>();
  while (stack.length) {
    const f = stack.pop()!;
    if (files.has(f)) continue;
    const code = await read(f);
    files.set(f, code);
    for (const spec of importSpecs(code)) {
      const r = resolveSpec(f, spec);
      if (r === null) {
        const pkg = packageOf(spec);
        if (pkg) packages.add(pkg);
      } else if (r === undefined) missing.push(`${f} → ${spec}`);
      else if (!files.has(r) && !GENERATED_FILES.has(r)) {
        if (!parent.has(r)) parent.set(r, f);
        stack.push(r);
      }
    }
  }

  const leaked = [...files.keys()].filter((f) => !overlay.has(f) && FORBIDDEN_IN_PROJECT.some((re) => re.test(f)));
  if (leaked.length) {
    const why = (f: string) => `${f}  ← ${parent.get(f) ?? "(نقطة دخول)"}`;
    throw new Error(`ملفات منصة تسربت إلى مشروع العميل:\n${leaked.sort().map(why).join("\n")}`);
  }
  return { files, packages, missing, overlay: new Set(overlay.keys()) };
}
