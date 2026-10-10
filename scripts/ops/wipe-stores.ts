// wipe-stores.ts — يحذف كل المتاجر التجريبية من قاعدة الإنتاج قبل الإطلاق (قرار المالك 2026-10-10: لا متاجر حالية).
// الافتراضي «معاينة فقط»: يعرض ما سيُحذف ولا يحذف شيئاً. الحذف الفعلي يحتاج:
//   npx tsx scripts/ops/wipe-stores.ts --execute --confirm=DELETE-ALL-STORES
// يحذف المتاجر وكل ما يتبعها (منتجات، طلبات، عملاء، تحليلات، تصميم، دفعات المنصة، المحادثات، الاستمارات، المهام المجدولة).
// لا يحذف حسابات التجار ولا فريق المنصة ولا قوالب الرسائل ولا إعدادات المنصة. صور UploadThing تُحذف يدوياً من لوحة uploadthing.com.
// شغّله من جهازك فقط (يقرأ DATABASE_URL من .env.local)، وخذ نسخة احتياطية من Neon أولاً (Branch من لوحة Neon).
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });
config();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL غير موجود في .env.local أو .env");
  const sql = neon(url);
  const execute = process.argv.includes("--execute");
  const confirmed = process.argv.includes("--confirm=DELETE-ALL-STORES");

  const host = new URL(url).host;
  const count = async (table: string) => Number(((await sql.query(`select count(*)::int as c from ${table}`)) as { c: number }[])[0]?.c ?? 0);
  const tables = ["stores", "products", "orders", "customers", "platform_payments", "conversations", "intakes", "scheduled_jobs", "merchants"];
  console.log(`قاعدة البيانات: ${host}\n`);
  for (const t of tables) console.log(`  ${t.padEnd(20)} ${await count(t)}`);
  const stores = (await sql.query(`select subdomain, name, status from stores order by created_at`)) as { subdomain: string; name: string; status: string }[];
  console.log(`\nالمتاجر التي ستُحذف (${stores.length}):`);
  for (const s of stores) console.log(`  - ${s.subdomain} (${s.name}) [${s.status}]`);

  if (!execute) {
    console.log("\nمعاينة فقط، لم يُحذف شيء. للحذف الفعلي أضف: --execute --confirm=DELETE-ALL-STORES");
    return;
  }
  if (!confirmed) throw new Error("أضف --confirm=DELETE-ALL-STORES لتأكيد الحذف.");

  // ترتيب يحترم المفاتيح الأجنبية التي لا تحذف تلقائياً (conversations/intakes بلا cascade).
  await sql.transaction([
    sql`delete from scheduled_jobs where store_id is not null`,
    sql`delete from intakes where store_id is not null`,
    sql`delete from conversations where store_id is not null`,
    sql`delete from stores`,
  ]);
  console.log("\n✓ حُذفت كل المتاجر وما يتبعها. الأعداد الآن:");
  for (const t of tables) console.log(`  ${t.padEnd(20)} ${await count(t)}`);
}

main().catch((e) => {
  console.error("✗ فشل:", e instanceof Error ? e.message : e);
  process.exit(1);
});
