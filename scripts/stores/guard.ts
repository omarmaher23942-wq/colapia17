// guard.ts — حارس عزل كود المتاجر الخاصة (stores/<slug>/**). يشغّله CI واختبار stores-isolation.
//
// القاعدة: كود المتجر لا يصل إلا لبيانات متجره، وعبر StoreKit فقط. لذلك المسموح استيراده قائمة بيضاء قصيرة:
//   - ملفات داخل مجلد المتجر نفسه (لا ملفات متجر آخر ولا ملفات النواة مباشرة)
//   - "@/stores-kit" (الواجهة الوحيدة من النواة)
//   - حزم عرض لا تصل لشيء: react, next/link, next/image, next/navigation, lucide-react, motion/react, clsx, zod
// وممنوع داخله: process.env، require، "use server"، eval/new Function، dangerouslySetInnerHTML.
// ملفات sections/blocks/slots/pages مكوّنات خادم (تستلم kit بدوال لا تعبر للمتصفح)؛ مكوّنات "use client"
// توضع في components/ داخل مجلد المتجر وتُستورد منها.
//
//   npx tsx scripts/stores/guard.ts      يفحص كل المتاجر ويخرج برمز 1 عند أي مخالفة
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, posix, relative } from "node:path";
import ts from "typescript";

export const ALLOWED_PACKAGES = new Set(["react", "next/link", "next/image", "next/navigation", "lucide-react", "motion/react", "clsx", "zod"]);
export const KIT = "@/stores-kit";
const CODE = /\.(tsx|ts)$/;
const ALLOWED_FILES = /\.(tsx|ts|css|json|md|png|jpe?g|webp|avif|svg|gif)$/i;
const SERVER_DIRS = new Set(["sections", "blocks", "slots", "pages"]);

const BANNED: { re: RegExp; why: string }[] = [
  { re: /\bprocess\s*\.\s*env\b/, why: "process.env ممنوع (لا أسرار في كود المتجر)" },
  { re: /\brequire\s*\(/, why: "require ممنوع (استخدم import من القائمة المسموحة)" },
  { re: /^\s*["']use server["']/m, why: '"use server" ممنوع: الكتابة في القاعدة من النواة فقط' },
  { re: /\beval\s*\(|\bnew\s+Function\s*\(/, why: "eval / new Function ممنوعان" },
  { re: /dangerouslySetInnerHTML/, why: "dangerouslySetInnerHTML ممنوع (اكتب JSX)" },
];

export type Violation = { file: string; message: string };

/** يفحص ملفاً واحداً. `file` مسار نسبي بصيغة stores/<slug>/... */
export function checkStoreFile(file: string, code: string): Violation[] {
  const out: Violation[] = [];
  const v = (message: string) => out.push({ file, message });
  const parts = file.split("/");
  if (parts[0] !== "stores" || parts.length < 3) return [{ file, message: "ليس داخل stores/<slug>/" }];
  const storeRoot = `stores/${parts[1]}`;

  if (!ALLOWED_FILES.test(file)) {
    v("نوع ملف غير مسموح في مجلد متجر");
    return out;
  }
  if (!CODE.test(file)) return out;

  const info = ts.preProcessFile(code, true, true);
  for (const imp of info.importedFiles) {
    const spec = imp.fileName;
    if (spec.startsWith(".")) {
      const target = posix.normalize(posix.join(posix.dirname(file), spec));
      if (!(target === storeRoot || target.startsWith(`${storeRoot}/`))) v(`"${spec}" يخرج من مجلد المتجر (ممنوع الوصول لملفات متجر آخر أو للنواة مباشرة)`);
    } else if (spec === KIT) {
      // الواجهة الوحيدة من النواة
    } else if (spec.startsWith("@/")) {
      v(`"${spec}" ممنوع: كود المتجر يستورد من النواة "${KIT}" فقط`);
    } else if (!ALLOWED_PACKAGES.has(spec)) {
      v(`الحزمة "${spec}" غير مسموحة (المسموح: ${[...ALLOWED_PACKAGES].join("، ")})`);
    }
  }
  for (const b of BANNED) if (b.re.test(code)) v(b.why);

  if (SERVER_DIRS.has(parts[2] ?? "") && /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*\s*["']use client["']/.test(code)) {
    v(`ملفات ${parts[2]}/ مكوّنات خادم (تستلم kit). ضع المكوّن التفاعلي في components/ واستورده منها`);
  }
  return out;
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

export function checkAllStores(root = process.cwd()): Violation[] {
  return walk(join(root, "stores"))
    .map((abs) => relative(root, abs).split("\\").join("/"))
    .filter((f) => !f.startsWith("stores/README") && !f.split("/")[1]?.startsWith("."))
    .flatMap((f) => checkStoreFile(f, ALLOWED_FILES.test(f) && CODE.test(f) ? readFileSync(join(root, f), "utf8") : ""));
}

const isMain = process.argv[1] && relative(process.cwd(), process.argv[1]).split("\\").join("/").replace(/\.ts$/, "") === "scripts/stores/guard";
if (isMain) {
  const found = checkAllStores();
  if (found.length) {
    console.error(`✗ حارس عزل المتاجر: ${found.length} مخالفة\n${found.map((x) => `  - ${x.file}: ${x.message}`).join("\n")}`);
    process.exit(1);
  }
  console.log("✓ حارس عزل المتاجر: لا مخالفات");
}
