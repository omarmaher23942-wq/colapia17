// يولّد مخطط قاعدة مشروع التاجر: npx drizzle-kit generate --config scripts/template-drizzle.config.ts
// ثم: npx tsx scripts/template-migrations-clean.ts (يحذف المفاتيح الأجنبية لجداول المنصة غير الموجودة).
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./scripts/template-schema.ts",
  out: "./template/drizzle",
  dialect: "postgresql",
  casing: "snake_case",
  strict: true,
});
