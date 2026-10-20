// seed-demo.ts — ينشئ/يحدّث متجر العرض `demo` (demo.colapia.com) بالأنظمة الجديدة (V3) من scripts/demo/data/*.json:
// متجر أحذية واحد كامل يُبنى بمسار المنصة نفسه (planCategories + planCommit + قالب البدء + الواجهة التلقائية): تصميم «منتصف الليل»
// ببطاقات زئبقية، ومنتجات بتركيبات ومخزون (نافد ومنخفض ومتوفر) وأسعار مشطوبة، وأقسام فرعية، ودليل مقاسات، وتقييمات وأسئلة مُجابة.
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
import { and, eq, or, sql } from "drizzle-orm";
import { db } from "../../src/db/client";
import { getTenantDb } from "../../src/db/tenant";
import { merchants, stores, storeBlueprints, categories, products, productVariants, productQuestions, reviews, discounts, shippingZones } from "../../src/db/schema";
import { canonicalEmail } from "../../src/lib/contact";
import { invalidateStoreCache } from "../../src/lib/tenant";
import {
  DEMO_COUPON, DEMO_DEFAULT_EMAIL, DEMO_MERCHANT_NAME, DEMO_SUB,
  buildCatalog, buildDemoBlueprint, demoStoreSettings, loadDemoProducts, questionsFor, ratingTotals, reviewsFor, shippingZoneRows, variantsOf,
} from "./catalog";
import { verifyDemo } from "./verify-demo";

const DAY = 864e5;

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
  const data = loadDemoProducts();
  const now = Date.now();

  // ─── صاحب اللوحة: حساب موجود بالبريد نفسه (فتبقى جلساته وربطه بـ Google)، وإلا حساب عرض جديد ───
  const canonical = canonicalEmail(email);
  let [m] = await db.select({ id: merchants.id }).from(merchants).where(or(eq(merchants.emailCanonical, canonical), eq(merchants.email, email))).limit(1);
  if (!m) {
    [m] = await db
      .insert(merchants)
      .values({ displayName: DEMO_MERCHANT_NAME, email, emailCanonical: canonical, isActivated: true, createdAt: new Date(now - 90 * DAY) })
      .returning({ id: merchants.id });
  }
  const merchantId = m!.id;

  // ─── حذف متجر العرض القديم (بمعرّفه وحده؛ صفوفه تسقط بالتتالي) ───
  const [old] = await db.select({ id: stores.id, merchantId: stores.merchantId, subdomain: stores.subdomain }).from(stores).where(eq(stores.subdomain, DEMO_SUB)).limit(1);
  if (old) {
    await db.delete(stores).where(eq(stores.id, old.id));
    await invalidateStoreCache(old);
    // صاحب العرض السابق (إن تغيّر البريد): يُحذف فقط حساب العرض الذي أنشأه السكربت وبلا أي متجر آخر. حساب تاجر حقيقي لا يُمس.
    if (old.merchantId !== merchantId) {
      const [left] = await db.select({ n: sql<number>`count(*)::int` }).from(stores).where(eq(stores.merchantId, old.merchantId));
      if (!Number(left?.n ?? 0)) await db.delete(merchants).where(and(eq(merchants.id, old.merchantId), eq(merchants.displayName, DEMO_MERCHANT_NAME)));
    }
  }

  const [s] = await db
    .insert(stores)
    .values({ merchantId, subdomain: DEMO_SUB, ...demoStoreSettings(now), createdAt: new Date(now - 62 * DAY) })
    .returning({ id: stores.id });
  const storeId = s!.id;
  const t = await getTenantDb(storeId);

  // ─── الأقسام والمنتجات: مخرجات المسار العادي (دمج الأقسام ثم planCommit) مع إضافات العرض ───
  const catalog = buildCatalog(data, now, storeId, () => crypto.randomUUID());
  await t.insert(categories).values(catalog.categories);
  const rows = catalog.rows;
  const inserted = rows.map((r) => ({ id: r.id, slug: r.slug }));
  const dbRows = rows.map(({ categoryKey: _k, ...r }) => ({ ...r, storeId, categoryId: r.categoryId }));
  for (let i = 0; i < dbRows.length; i += 25) await t.insert(products).values(dbRows.slice(i, i + 25));
  const idOf = new Map(inserted.map((r) => [r.slug, r.id]));
  const catId = Object.fromEntries(catalog.categories.map((c) => [c.slug, c.id]));

  // ─── التركيبات (مقاس × لون) بمخزون موزّع، وصورة لكل لون عند تعدد الألوان ───
  const variantRows: (typeof productVariants.$inferInsert)[] = data.flatMap((p) => variantsOf(p).map((v) => ({ storeId, productId: idOf.get(p.slug)!, ...v })));
  for (let i = 0; i < variantRows.length; i += 100) await t.insert(productVariants).values(variantRows.slice(i, i + 100));

  // ─── التقييمات (مجاميع كل منتج مطابقة لصفوفه) ───
  const reviewList = reviewsFor(data, rows, now);
  const reviewRows: (typeof reviews.$inferInsert)[] = reviewList.map((r) => ({
    storeId, productId: idOf.get(r.slug)!, customerName: r.customerName, rating: r.rating, body: r.body, isApproved: true,
    // تقييمات عرض بلا طلب حقيقي: ليست «موثّقة» ولا تحمل شارة المشتري الموثّق.
    isVerified: false,
    createdAt: r.createdAt,
  }));
  for (let i = 0; i < reviewRows.length; i += 100) await t.insert(reviews).values(reviewRows.slice(i, i + 100));
  const totals = ratingTotals(reviewList);
  for (const [slug, a] of totals) await t.update(products).set({ ratingSum: a.sum, ratingCount: a.count }).where(eq(products.id, idOf.get(slug)!));

  // ─── أسئلة مُجابة ───
  const qRows: (typeof productQuestions.$inferInsert)[] = questionsFor(data, rows, now).map((q) => ({
    storeId, productId: idOf.get(q.slug)!, question: q.question, answer: q.answer, askerName: q.askerName, status: "answered", createdAt: q.createdAt, answeredAt: q.answeredAt,
  }));
  if (qRows.length) await t.insert(productQuestions).values(qRows);

  // ─── الشحن والخصم ───
  await t.insert(shippingZones).values(shippingZoneRows().map((z) => ({ ...z, storeId })));
  await t.insert(discounts).values({ storeId, code: DEMO_COUPON.code, type: "percentage", value: DEMO_COUPON.percent, isActive: true });

  // ─── الـ Blueprint (يُفحص بمخططه داخل buildDemoBlueprint) ───
  const bp = buildDemoBlueprint({ storeId, email, categoryIds: catId, productCount: rows.length, data });
  await t.insert(storeBlueprints).values({ storeId, data: bp, updatedBy: "demo-seed" });
  await invalidateStoreCache({ id: storeId, subdomain: DEMO_SUB });

  const sold = rows.filter((r) => r.stock === 0).length;
  const low = rows.filter((r) => r.stock > 0 && r.stock <= 5).length;
  console.log(
    `✓ متجر العرض جاهز: ${rows.length} منتجاً (${sold} نافد، ${low} كمية منخفضة)، ${variantRows.length} تركيبة، ` +
      `${reviewRows.length} تقييماً على ${totals.size} منتجاً، ${qRows.length} سؤالاً مُجاباً، ${bp.sizeGuide.charts.length} جداول مقاسات. صاحب اللوحة: ${email}`,
  );
  console.log(local ? "  http://demo.localhost:3100" : "  https://demo.colapia.com");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
