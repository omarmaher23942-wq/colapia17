// seed-demo.ts — ينشئ/يحدّث متجر العرض `demo` (demo.colapia.com) بالأنظمة الجديدة (V3) من scripts/demo/data/*.json:
// متجر أزياء نسائية واحد كامل يُبنى بمسار المنصة نفسه (planCategories + planCommit + قالب البدء) وبأقسام مخصصة من stores/demo: تصميم «عاجي»
// ومنتجات بتركيبات ومخزون (نافد ومنخفض ومتوفر) وأسعار مشطوبة، وأقسام فرعية، ودليل مقاسات، وتقييمات وأسئلة مُجابة.
// البيانات والـ Blueprint من scripts/demo/catalog.ts (منطق خالص يفحصه verify-demo.ts دون اتصال).
//
// الاستخدام:
//   محلياً:   bash scripts/dev/preview.sh demo            ثم http://demo.localhost:3100
//   الإنتاج:  DEMO_SEED_PRODUCTION=yes npx tsx --require ./scripts/dev/no-server-only.cjs scripts/demo/seed-demo.ts
//             (بأسرار الإنتاج على جهاز المالك؛ بلا المتغير يرفض السكربت أي قاعدة غير محلية)
//   البريد:   DEMO_MERCHANT_EMAIL=... يحدد صاحب لوحة متجر العرض (الافتراضي demo@colapia.com). إن كان البريد لحساب تاجر
//             موجود يُستخدم الحساب نفسه ولا يُنشأ غيره.
//
// إعادة التشغيل آمنة: يحذف متجر العرض وحده (بمعرّفه، فتسقط صفوفه بالتتالي) ويعيد بناءه، ويمسح ذاكرة المتجر المؤقتة.
// لا يحذف حساب تاجر إلا حساب العرض الذي أنشأه السكربت نفسه وبلا متاجر أخرى. ولا يمس أي متجر آخر.
import { seedDemo } from "./seed-core";
import { verifyDemo } from "./verify-demo";
import { DEMO_DEFAULT_EMAIL } from "./catalog";

function demoEmail(): string {
  const raw = (process.env.DEMO_MERCHANT_EMAIL ?? "").trim().toLowerCase();
  if (!raw) return DEMO_DEFAULT_EMAIL;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) throw new Error(`DEMO_MERCHANT_EMAIL غير صالح: ${raw}`);
  return raw;
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) throw new Error("DATABASE_URL مطلوب");
  const local = /@[^/]+\.local\.neon\//.test(url);
  if (!local && process.env.DEMO_SEED_PRODUCTION !== "yes") {
    throw new Error("قاعدة غير محلية: شغّله محلياً عبر scripts/dev/preview.sh demo، أو ضع DEMO_SEED_PRODUCTION=yes عن قصد.");
  }

  // الفحص دون اتصال أولاً: لا يُكتب شيء في القاعدة إن كان في البيانات أو الـ Blueprint أو الصور أي خلل.
  const check = verifyDemo();
  if (check.errors.length) throw new Error(`فحص متجر العرض فشل:\n- ${check.errors.join("\n- ")}`);

  const email = demoEmail();
  const r = await seedDemo(email);
  console.log(`✓ متجر العرض جاهز: ${r.products} منتجاً (${r.soldOut} نافد، ${r.low} كمية منخفضة)، ${r.variants} تركيبة، ${r.reviews} تقييماً، ${r.questions} سؤالاً مُجاباً. صاحب اللوحة: ${email}`);
  console.log(local ? "  http://demo.localhost:3100" : "  https://demo.colapia.com");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
