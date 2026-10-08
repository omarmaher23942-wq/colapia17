// planes.ts — تصنيف كل جدول إلى مستوى التحكم (المنصة) أو مستوى بيانات المتجر.
//
// - مستوى التحكم: يبقى دائماً في قاعدة المنصة (التجار، المتاجر، الجلسات، الدفع للمنصة، البناء، البوت...).
// - بيانات المتجر: تعيش في قاعدة المنصة أثناء التجربة، وتنتقل إلى قاعدة التاجر الخاصة عند "امتلك متجرك".
//   الوصول إليها عبر getTenantDb(storeId) فقط، ولا تشير إليها أي جداول التحكم بمفتاح أجنبي.
//
// مشروع التاجر الخاص (template/) يحمل جداول بيانات المتجر + صفوف ANCHOR_TABLES الخاصة به وحده.
// اختبار tests/unit/planes.test.ts يفرض أن كل جدول مصنَّف مرة واحدة.

export const TENANT_TABLES = [
  "categories",
  "products",
  "product_variants",
  "customers",
  "shipping_zones",
  "discounts",
  "orders",
  "order_items",
  "payments",
  "reviews",
  "abandoned_carts",
  "analytics_events",
  "analytics_daily",
  "support_threads",
  "support_messages",
  "marketing_campaigns",
] as const;

export const CONTROL_TABLES = [
  "platform_users",
  "merchants",
  "sessions",
  "platform_reviews",
  "stores",
  "store_blueprints",
  "store_snapshots",
  "platform_payments",
  "conversations",
  "messages",
  "intakes",
  "build_jobs",
  "ai_calls",
  "scheduled_jobs",
  "prompts",
  "onboarding_sessions",
  "onboarding_assets",
  "lifecycle_events",
  "ai_directives",
  "message_templates",
  "system_events",
  "magic_links",
  "feature_flags",
  "merchant_referrals",
  "referral_rewards",
  "store_transfers",
  "outreach_campaigns",
  "email_optouts",
] as const;

/** صفوف تحكم تُنقل إلى قاعدة التاجر لتصح المفاتيح الأجنبية ويعمل مشروعه مستقلاً. */
export const ANCHOR_TABLES = ["merchants", "stores", "store_blueprints"] as const;

export type TenantTable = (typeof TENANT_TABLES)[number];
export type ControlTable = (typeof CONTROL_TABLES)[number];
