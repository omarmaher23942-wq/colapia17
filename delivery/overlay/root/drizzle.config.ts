// drizzle.config.ts — إعداد drizzle-kit: توليد ملفات التحديث (migrations) من مخطط الجداول، وتطبيقها بـ npm run db:migrate.
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  casing: "snake_case",
  strict: true,
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
