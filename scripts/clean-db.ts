import "dotenv/config";
import { sql } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";

/**
 * سكربت تصفير قاعدة بيانات Colapia بأمان وسرعة قبل إطلاق الإعلانات
 * التشغيل: npx tsx scripts/clean-db.ts
 */
async function cleanDatabase() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("❌ DATABASE_URL is missing in environment variables.");
    process.exit(1);
  }

  const client = neon(dbUrl);

  console.log("🧹 بدء عملية تصفير وتنظيف قاعدة البيانات استعداداً للإطلاق...");

  try {
    // 1. تفريغ الجداول مع الحفاظ التام على حسابات مالكي المنصة (platform_users)
    await client`
      TRUNCATE TABLE
        analytics_events,
        analytics_daily,
        abandoned_carts,
        order_items,
        payments,
        orders,
        reviews,
        platform_reviews,
        platform_payments,
        product_variants,
        products,
        categories,
        shipping_zones,
        discounts,
        customers,
        store_snapshots,
        store_blueprints,
        build_jobs,
        ai_directives,
        lifecycle_events,
        scheduled_jobs,
        onboarding_assets,
        onboarding_sessions,
        intakes,
        messages,
        conversations,
        stores,
        merchants,
        sessions,
        ai_calls,
        system_events
      CASCADE;
    `;

    console.log("✅ تم تفريغ كافة المتاجر، الأوردرات، التحويلات، وسجلات الـ AI التجريبية بنجاح.");
    console.log("🔒 تم الحفاظ على مستخدمي المنصة (platform_users) وإعدادات Feature Flags.");

    process.exit(0);
  } catch (error) {
    console.error("❌ حدث خطأ أثناء تنظيف قاعدة البيانات:", error);
    process.exit(1);
  }
}

cleanDatabase();