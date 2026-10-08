// store-template.ts — يولّد مشروع متجر تاجر تجريبياً في مجلد، لفحصه قبل أي نشر.
//
// الاستخدام:
//   npx tsx scripts/store-template.ts --out ../store-check            (توليد فقط)
//   npx tsx scripts/store-template.ts --out ../store-check --check    (توليد + فحص الأنواع)
// الفحص يربط node_modules بالمستودع ويشغّل tsc على المشروع المولّد؛ أي خطأ يعني أن مشروع
// التاجر لن يُبنى، فلا يُعتمد أي تغيير حتى ينجح.
import { mkdir, rm, writeFile, symlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { blueprintSchema } from "@/blueprint/schema";
import { defaultBlueprint } from "@/blueprint/defaults";
import { buildStoreProject } from "@/server/ownership/template";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const root = process.cwd();
  const out = resolve(arg("out") ?? join(root, "..", "store-template-check"));
  const blueprint = blueprintSchema.parse(defaultBlueprint({ name: "متجر التجربة", storeId: "00000000-0000-0000-0000-000000000000" } as never));
  const { files, missing } = await buildStoreProject(root, {
    storeName: "متجر التجربة",
    subdomain: "demo",
    blueprint,
    platformOrigin: "https://colapia.com",
  });

  if (existsSync(out)) await rm(out, { recursive: true, force: true });
  for (const f of files) {
    const p = join(out, f.path);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, f.data);
  }
  console.log(`✓ ${files.length} ملفاً في ${out}`);
  if (missing.length) {
    console.error(`✗ استيرادات لم تُحل:\n${missing.join("\n")}`);
    process.exitCode = 1;
  }

  if (process.argv.includes("--check")) {
    const nm = join(out, "node_modules");
    const source = existsSync(join(root, "node_modules")) ? join(root, "node_modules") : join(root, "..", "node_modules");
    await symlink(source, nm, "junction");
    const tsc = join(source, "typescript", "bin", "tsc");
    try {
      execFileSync(process.execPath, [tsc, "-p", "tsconfig.json", "--noEmit"], { cwd: out, stdio: "inherit" });
      console.log("✓ فحص الأنواع لمشروع المتجر نجح");
    } catch {
      console.error("✗ فحص الأنواع لمشروع المتجر فشل");
      process.exitCode = 1;
    }
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
