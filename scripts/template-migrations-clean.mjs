// template-migrations-clean.mjs — بعد توليد template/drizzle: يحذف المفاتيح الأجنبية التي تشير لجداول
// المنصة (غير موجودة في قاعدة التاجر) من ملفات SQL واللقطات، ويضيف امتداد pg_trgm للبحث العربي.
// الاستخدام: node scripts/template-migrations-clean.mjs
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "template/drizzle";
const PLATFORM = ["platform_users"];
const ref = new RegExp(`REFERENCES "public"\."(${PLATFORM.join("|")})"`);

for (const f of readdirSync(DIR).filter((f) => f.endsWith(".sql"))) {
  const p = join(DIR, f);
  let lines = readFileSync(p, "utf8").split("\n").filter((l) => !ref.test(l));
  let sql = lines.join("\n");
  if (/gin_trgm_ops/.test(sql) && !/pg_trgm/.test(sql.split("\n")[0] ?? "")) sql = `CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint\n${sql}`;
  writeFileSync(p, sql);
}

for (const f of readdirSync(join(DIR, "meta")).filter((f) => f.endsWith("_snapshot.json"))) {
  const p = join(DIR, "meta", f);
  const snap = JSON.parse(readFileSync(p, "utf8"));
  for (const t of Object.values(snap.tables ?? {})) {
    for (const [k, fk] of Object.entries(t.foreignKeys ?? {})) if (PLATFORM.includes(fk.tableTo)) delete t.foreignKeys[k];
  }
  writeFileSync(p, JSON.stringify(snap, null, 2));
}
console.log("✓ template/drizzle نظيف");
