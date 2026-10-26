// delivery-migrations.ts — يولّد مجلد migrations لمشروع العميل (delivery/overlay/drizzle) من مخطط المنصة الحالي لجداول المتجر وحدها.
//
// الاستخدام (بعد أي تغيير في جداول المتجر، أي ملف تحت src/db/schema ضمن ما يصدّره delivery/overlay/src/db/schema/index.ts):
//   npx tsx --require ./scripts/dev/no-server-only.cjs scripts/delivery-migrations.ts
// يولّد المشروع في مجلد مؤقت (بمجلد drizzle الحالي إن وُجد فتخرج الفروق وحدها كملف جديد)، ويشغّل drizzle-kit generate داخله،
// ثم ينسخ النتيجة إلى delivery/overlay/drizzle. لا اتصال بأي قاعدة بيانات.
import { cp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { localSource } from "@/delivery/source";
import { buildDeliveryProject } from "@/delivery/build";
import { SAMPLE_IDENTITY } from "@/delivery/sample";

async function main() {
  const root = process.cwd();
  const tmp = join(tmpdir(), `delivery-mig-${process.pid}`);
  await rm(tmp, { recursive: true, force: true });
  const { files } = await buildDeliveryProject(await localSource(root), SAMPLE_IDENTITY, { allowMissingMigrations: true });
  for (const f of files) {
    const p = join(tmp, f.path);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, f.data);
  }
  await symlink(join(root, "node_modules"), join(tmp, "node_modules"), "junction");
  const existing = existsSync(join(root, "delivery/overlay/drizzle/meta/_journal.json"));
  const name = existing ? (process.argv[2] ?? "update") : "init";
  execFileSync(join(tmp, "node_modules", ".bin", "drizzle-kit"), ["generate", "--name", name], { cwd: tmp, stdio: "inherit" });

  // البحث العربي يعتمد pg_trgm: يُنشأ الامتداد قبل أي فهرس يستخدمه.
  const dir = join(tmp, "drizzle");
  for (const f of (await readdir(dir)).filter((n) => n.endsWith(".sql"))) {
    const sql = await readFile(join(dir, f), "utf8");
    if (/gin_trgm_ops/.test(sql) && !/CREATE EXTENSION IF NOT EXISTS pg_trgm/.test(sql)) {
      await writeFile(join(dir, f), `CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint\n${sql}`);
    }
  }

  const out = resolve(root, "delivery/overlay/drizzle");
  await rm(out, { recursive: true, force: true });
  await cp(dir, out, { recursive: true });
  await rm(tmp, { recursive: true, force: true });
  console.log(`✓ delivery/overlay/drizzle (${existsSync(out) ? (await readdir(out)).length : 0} عنصراً)`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exit(1);
});
