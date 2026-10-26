// transfer-embed.ts — يضمّن migrations مشروع العميل (delivery/overlay/drizzle) في وحدة TS تستخدمها «نقل البيانات».
// الاستخدام (بعد كل توليد جديد لـ delivery-migrations): npm run transfer:embed
// يفشل اختبار tests/unit/transfer-migrations.test.ts إن بقيت الوحدة قديمة.
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { embedMigrations, migrationsModule } from "@/delivery/inject";

async function main() {
  const dir = join(process.cwd(), "delivery/overlay/drizzle");
  const journal = await readFile(join(dir, "meta/_journal.json"), "utf8");
  const sqlByTag: Record<string, string> = {};
  for (const f of (await readdir(dir)).filter((n) => n.endsWith(".sql"))) sqlByTag[f.replace(/\.sql$/, "")] = await readFile(join(dir, f), "utf8");
  const out = migrationsModule(embedMigrations(journal, sqlByTag)).replace("npm run db:embed", "npm run transfer:embed");
  await writeFile(join(process.cwd(), "src/server/transfer/migrations.generated.ts"), out);
  console.log("ok");
}
void main();
