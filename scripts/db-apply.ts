// يطبّق ملف SQL واحداً من drizzle/ على قاعدة DATABASE_URL (من .env.local ثم .env).
// الاستخدام: npm run db:apply -- drizzle/0008_intake_per_store.sql
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });
config();

async function main() {
  const file = process.argv[2];
  const url = process.env.DATABASE_URL;
  if (!file) throw new Error("حدد ملف SQL: npm run db:apply -- drizzle/<file>.sql");
  if (!url) throw new Error("DATABASE_URL غير موجود في .env.local أو .env");

  const sql = neon(url);
  const statements = readFileSync(file, "utf8")
    .split("--> statement-breakpoint")
    .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
    .filter(Boolean);

  for (const st of statements) {
    console.log(`→ ${st.split("\n")[0]}`);
    await sql.query(st);
  }
  console.log(`✓ طُبّق ${file} (${statements.length} أمر)`);
}

main().catch((e) => {
  console.error("✗ فشل التطبيق:", e instanceof Error ? e.message : e);
  process.exit(1);
});
