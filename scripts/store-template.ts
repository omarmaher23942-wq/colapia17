// store-template.ts — يولّد مشروع عميل تجريبياً في مجلد، لفحصه قبل أي تسليم (وفي CI).
//
// الاستخدام:
//   npx tsx scripts/store-template.ts --out ../store-check                     (توليد فقط)
//   npx tsx scripts/store-template.ts --out ../store-check --check             (توليد + tsc)
//   npx tsx scripts/store-template.ts --out ../store-check --check --build     (+ next build بلا قاعدة بيانات)
//   --install   npm install داخل المشروع المولّد بدل ربط node_modules بالمنصة (يتحقق من package.json فعلاً)
// خيارات الهوية: --name "اسم" --email me@example.com --niche fashion --slug my-shop --ig handle --wa 01012345678
// أي خطأ يعني أن مشروع العميل لن يُبنى، فلا يُعتمد أي تغيير في المنصة حتى ينجح.
import { mkdir, rm, writeFile, symlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { localSource } from "@/delivery/source";
import { buildDeliveryProject } from "@/delivery/build";
import type { DeliveryIdentity } from "@/delivery/types";
import { SAMPLE_IDENTITY } from "@/delivery/sample";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const flag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const root = process.cwd();
  const out = resolve(arg("out") ?? join(root, "..", "store-check"));
  const id: DeliveryIdentity = {
    ...SAMPLE_IDENTITY,
    storeName: arg("name") ?? SAMPLE_IDENTITY.storeName,
    slug: arg("slug") ?? arg("folder") ?? SAMPLE_IDENTITY.slug,
    ownerEmail: arg("email") ?? SAMPLE_IDENTITY.ownerEmail,
    niche: arg("niche") ?? SAMPLE_IDENTITY.niche,
    instagram: arg("ig") ?? SAMPLE_IDENTITY.instagram,
    whatsapp: arg("wa") ?? SAMPLE_IDENTITY.whatsapp,
    storeFolder: arg("folder") ?? null,
  };
  const { files, missing } = await buildDeliveryProject(await localSource(root), id, { allowMissingMigrations: flag("no-migrations") });

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
    return;
  }

  if (flag("check") || flag("build") || flag("install")) {
    if (flag("install")) {
      execFileSync("npm", ["install", "--no-audit", "--no-fund", "--prefer-offline"], { cwd: out, stdio: "inherit" });
    } else {
      const source = existsSync(join(root, "node_modules")) ? join(root, "node_modules") : join(root, "..", "node_modules");
      await symlink(source, join(out, "node_modules"), "junction");
    }
    const bin = (name: string) => join(out, "node_modules", ".bin", name);
    try {
      execFileSync(bin("tsc"), ["--noEmit"], { cwd: out, stdio: "inherit" });
      console.log("✓ فحص الأنواع لمشروع العميل نجح");
    } catch {
      console.error("✗ فحص الأنواع لمشروع العميل فشل");
      process.exitCode = 1;
      return;
    }
    if (flag("build")) {
      try {
        execFileSync(bin("next"), ["build"], {
          cwd: out,
          stdio: "inherit",
          env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_APP_URL: "https://demo.example.com", APP_URL: "https://demo.example.com" },
        });
        console.log("✓ next build لمشروع العميل نجح");
      } catch {
        console.error("✗ next build لمشروع العميل فشل");
        process.exitCode = 1;
      }
    }
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exit(1);
});
