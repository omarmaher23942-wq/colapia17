// يطبّق migrations المعلّقة من drizzle/ على قاعدة DATABASE_URL (من .env.local ثم .env)،
// بنفس سائق HTTP الذي يستخدمه التطبيق. يُستخدم لقاعدة المنصة الآن، ولقاعدة كل تاجر عند الانتقال (W3).
// الاستخدام: npm run db:migrate
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

config({ path: ".env.local" });
config();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL غير موجود في .env.local أو .env");
  await migrate(drizzle({ client: neon(url) }), { migrationsFolder: "drizzle" });
  console.log("✓ القاعدة محدّثة بكل الـ migrations");
}

main().catch((e) => {
  console.error("✗ فشل:", e instanceof Error ? e.message : e);
  process.exit(1);
});
