// store-local.ts — جدول إعدادات هذا المشروع (غير موجود على المنصة): كلمة مرور صاحب المتجر ورمز الاسترجاع، ومفاتيحك الخاصة
// التي تدخلها من لوحة التحكم (Groq وغيره)، وحالة الإعداد الأول. القاعدة قاعدتك أنت، والمفاتيح لا تُعرض كاملة في الواجهة.
import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const storeSettings = pgTable("store_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
