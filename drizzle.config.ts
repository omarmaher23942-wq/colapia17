import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });
config();

/**
 * إعداد drizzle-kit: توليد وتشغيل الـ migrations على Neon.
 * الأوامر: npm run db:generate (يولّد migration) ثم npm run db:migrate (scripts/db-migrate.ts عبر HTTP)
 * خط الأساس: drizzle/0000_baseline.sql (السلسلة القديمة في drizzle/legacy للمرجع فقط).
 */
export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
  verbose: true,
  strict: true,
});
