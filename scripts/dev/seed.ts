// seed.ts — بيانات تطوير واقعية لمعاينة لوحة التاجر والمتجر محلياً (لا تُشغَّل على الإنتاج أبداً).
// تاجر ومتجر تجربة بمنتجات ومتغيرات وطلبات بحالات مختلفة على 60 يوماً، وعملاء، ومراجعات، وسلات متروكة،
// وزيارات. تطبع في النهاية كوكي جلسة التاجر (clp_m) للدخول بلا Google.
// الاستخدام: عبر scripts/dev/preview.sh (أو DATABASE_URL=... npx tsx scripts/dev/seed.ts داخل بيئة التطوير المعزولة).
import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, sql } from "drizzle-orm";
import * as schema from "../../src/db/schema";
import { defaultBlueprint } from "../../src/blueprint/defaults";
import { defaultShippingZones } from "../../src/lib/egypt";
import { buildSearchText, slugify } from "../../src/lib/arabic";

const {
  merchants, stores, storeBlueprints, categories, products, productVariants, shippingZones,
  customers, orders, orderItems, reviews, abandonedCarts, analyticsEvents, sessions, discounts,
} = schema;

const DAY = 864e5;
const rnd = (() => {
  let s = 20261009;
  return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
})();
const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]!;
const sha = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

/** صورة منتج تجريبية بلا شبكة: SVG بلون مختلف لكل منتج وحرفه الأول. */
function productImage(name: string, i: number): string {
  const hues = [18, 200, 330, 150, 45, 260, 0, 95, 220];
  const h = hues[i % hues.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 750"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h} 55% 78%)"/><stop offset="1" stop-color="hsl(${h} 45% 52%)"/></linearGradient></defs><rect width="600" height="750" fill="url(#g)"/><text x="300" y="430" font-family="sans-serif" font-size="220" font-weight="700" text-anchor="middle" fill="rgba(255,255,255,.85)">${name.charAt(0)}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL مطلوب");
  // يعمل فقط على القاعدة المحلية خلف المحاكي (host *.local.neon) حتى لا يُكتب على قاعدة حقيقية بالخطأ.
  if (!/@[^/]+\.local\.neon\//.test(url)) throw new Error("seed للتطوير المحلي فقط: شغّله عبر scripts/dev/preview.sh");
  const db = drizzle({ client: neon(url), schema, casing: "snake_case" });

  const existing = await db.select().from(stores).where(eq(stores.subdomain, "nova")).limit(1);
  if (existing[0]) {
    await db.delete(stores).where(eq(stores.id, existing[0].id));
    await db.delete(merchants).where(eq(merchants.id, existing[0].merchantId));
  }

  const now = Date.now();
  const [m] = await db
    .insert(merchants)
    .values({ displayName: "عمر ماهر", email: "omar.dev@example.com", isActivated: true, phone: "01012345678", createdAt: new Date(now - 20 * DAY) })
    .returning();
  const [s] = await db
    .insert(stores)
    .values({
      merchantId: m!.id, subdomain: "nova", name: "نوفا ستايل", status: "trial",
      deliveredAt: new Date(now - 4 * 3600e3), demoStartedAt: new Date(now - 4 * 3600e3),
      demoExpiresAt: new Date(now + 20 * 3600e3), trialEndsAt: new Date(now + 20 * 3600e3),
    })
    .returning();
  const storeId = s!.id;

  const bp = defaultBlueprint({ name: "نوفا ستايل", tagline: "أزياء يومية بخامات مريحة", industry: "fashion", vodafoneCash: "01012345678", inspectionAllowed: true, storeId });
  await db.insert(storeBlueprints).values({ storeId, data: bp });
  await db.insert(shippingZones).values(defaultShippingZones().map((z) => ({ ...z, storeId })));

  const cats = await db
    .insert(categories)
    .values([
      { storeId, name: "فساتين", slug: "فساتين", sortOrder: 0 },
      { storeId, name: "قمصان", slug: "قمصان", sortOrder: 1 },
      { storeId, name: "أحذية", slug: "احذيه", sortOrder: 2 },
    ])
    .returning();

  const catalog: Array<[string, number, number | null, number, number | null]> = [
    ["فستان كتان صيفي", 45000, 59900, 0, 14],
    ["فستان سهرة أسود", 89900, null, 0, 2],
    ["فستان مشجّر قصير", 52000, null, 0, 0],
    ["قميص أكسفورد أبيض", 39900, 45000, 1, 30],
    ["قميص جينز", 42000, null, 1, 3],
    ["تيشيرت قطن بيزك", 19900, null, 1, 60],
    ["حذاء رياضي أبيض", 69900, 85000, 2, 9],
    ["صندل جلد طبيعي", 39900, null, 2, 1],
    ["حذاء كلاسيك بني", 74900, null, 2, 12],
  ];
  const prods = await db
    .insert(products)
    .values(
      catalog.map(([name, price, cmp, ci, stock], i) => ({
        storeId, categoryId: cats[ci]!.id, name, slug: slugify(name), pricePiasters: price, compareAtPiasters: cmp,
        costPiasters: Math.round(price * 0.55), stock, trackStock: stock !== null, status: i === 8 ? ("draft" as const) : ("active" as const),
        images: [{ url: productImage(name, i), alt: name }], searchText: buildSearchText([name]), shortDescription: `${name} بخامة مريحة وتفاصيل مدروسة.`,
        viewCount: Math.floor(rnd() * 400), sortOrder: i,
        optionNames: i === 0 ? ["المقاس", "اللون"] : [],
        createdAt: new Date(now - (30 - i) * DAY),
      }))
    )
    .returning();

  // متغيرات للمنتج الأول: مقاس × لون، وتركيبة نفدت.
  const sizes = ["S", "M", "L"];
  const colors = ["بيج", "أبيض"];
  const variantRows = sizes.flatMap((sz) => colors.map((c) => ({ storeId, productId: prods[0]!.id, optionValues: [sz, c], stock: sz === "L" && c === "أبيض" ? 0 : 3 })));
  await db.insert(productVariants).values(variantRows);

  const names = ["سارة أحمد", "محمد علي", "منة الله حسن", "أحمد سمير", "ياسمين فؤاد", "كريم عادل", "هبة محمود", "مصطفى رضا", "نورهان إبراهيم", "عمرو خالد", "دينا شريف", "يوسف طارق", "ريم عبد الله", "حسام جمال", "لمياء صلاح"];
  const govs = ["cairo", "giza", "alexandria", "dakahlia", "sharqia", "gharbia", "qalyubia"];
  const custs = await db
    .insert(customers)
    .values(names.map((name, i) => ({ storeId, name, phone: `010${String(10000000 + i * 7919).slice(0, 8)}`, governorate: pick(govs), createdAt: new Date(now - (55 - i * 3) * DAY) })))
    .returning();

  const statuses = ["delivered", "delivered", "delivered", "shipped", "preparing", "confirmed", "cancelled", "returned"] as const;
  let seq = 1000;
  for (let i = 0; i < 46; i++) {
    const c = pick(custs);
    const ageDays = i < 4 ? rnd() * 0.3 : rnd() * 58;
    const created = new Date(now - ageDays * DAY);
    const transfer = i === 4 || i === 5;
    const status = i < 6 ? "new" : pick(statuses);
    const method = i === 4 ? "vodafone_cash" : i === 5 ? "instapay" : pick(["cod", "cod", "cod", "instapay"] as const);
    const lines = Array.from({ length: 1 + Math.floor(rnd() * 2) }, () => pick(prods.slice(0, 8)));
    const subtotal = lines.reduce((a, p) => a + p.pricePiasters, 0);
    const shipping = 6000;
    const rich = i === 0; // طلب بكل التفاصيل: خصم، رسوم تحصيل، علامة مميزة، رقم بديل، بريد، ملاحظة
    const codFee = rich ? 1000 : 0;
    const discount = rich ? 5000 : 0;
    const total = subtotal + shipping + codFee - discount;
    const [o] = await db
      .insert(orders)
      .values({
        storeId, customerId: c.id, code: `CLP-${++seq}`, status, customerName: c.name, customerPhone: c.phone,
        governorate: c.governorate ?? "cairo", city: "مدينة نصر", address: "شارع عباس العقاد، عمارة 12", subtotalPiasters: subtotal,
        shippingPiasters: shipping, codFeePiasters: codFee, discountPiasters: discount, discountCode: rich ? "WELCOME50" : null,
        totalPiasters: total, paymentMethod: rich ? "cod" : method,
        paymentStatus: transfer ? "under_review" : status === "delivered" ? "confirmed" : "pending",
        transferScreenshotUrl: transfer ? productImage("إيصال", 6) : null,
        transferSenderPhone: transfer ? "01155556666" : null,
        ...(rich ? { landmark: "أمام صيدلية العزبي", customerAltPhone: "01223334444", customerEmail: "customer@example.com", customerNotes: "يفضل الاتصال قبل الوصول بنصف ساعة" } : {}),
        statusHistory: [{ status: "new", at: created.toISOString() }], createdAt: created, updatedAt: created,
      })
      .returning();
    await db.insert(orderItems).values(lines.map((p) => ({ storeId, orderId: o!.id, productId: p.id, name: p.name, unitPiasters: p.pricePiasters, quantity: 1, totalPiasters: p.pricePiasters })));
  }

  // أعداد العملاء كما يحدّثها الدفع الحقيقي (عدد الطلبات والإنفاق وآخر طلب).
  await db.execute(sql`
    update customers c set
      orders_count = s.n, total_spent_piasters = s.spent, last_order_at = s.last
    from (
      select customer_id, count(*) as n,
        coalesce(sum(total_piasters) filter (where status not in ('cancelled','returned')), 0) as spent,
        max(created_at) as last
      from orders where store_id = ${storeId} group by customer_id
    ) s
    where c.id = s.customer_id`);

  // القطع المبيعة لكل منتج كما يحدّثها الدفع (وتُطرح عند الإلغاء أو المرتجع).
  await db.execute(sql`
    update products p set order_count = s.qty
    from (
      select i.product_id, sum(i.quantity) as qty
      from order_items i join orders o on o.id = i.order_id
      where o.store_id = ${storeId} and o.status not in ('cancelled','returned')
      group by i.product_id
    ) s
    where p.id = s.product_id and p.store_id = ${storeId}`);

  // أكواد خصم بحالات مختلفة (يعمل، ينتهي قريباً بحد استخدام، موقوف، منتهٍ). WELCOME50 مستخدم في طلب البذرة الغني.
  await db.insert(discounts).values([
    { storeId, code: "WELCOME50", type: "fixed", value: 5000, minSubtotalPiasters: 30000, perCustomerLimit: 1, usedCount: 1 },
    { storeId, code: "SUMMER15", type: "percentage", value: 15, maxUses: 20, usedCount: 7, endsAt: new Date(Date.now() + 5 * DAY) },
    { storeId, code: "FREESHIP", type: "free_shipping", value: 0, minSubtotalPiasters: 50000, isActive: false },
    { storeId, code: "RAMADAN10", type: "percentage", value: 10, endsAt: new Date(Date.now() - 20 * DAY), usedCount: 3 },
  ]);

  await db.insert(reviews).values([
    { storeId, productId: prods[0]!.id, customerName: "سارة أحمد", rating: 5, body: "الخامة ممتازة والمقاس مضبوط.", isApproved: true },
    { storeId, productId: prods[3]!.id, customerName: "أحمد سمير", rating: 4, body: "القميص جميل لكن التوصيل تأخر يوماً.", isApproved: true },
    { storeId, productId: prods[6]!.id, customerName: "ياسمين فؤاد", rating: 5, body: "مريح جداً.", isApproved: false },
    { storeId, productId: prods[1]!.id, customerName: "هبة محمود", rating: 3, body: "اللون أغمق قليلاً من الصورة.", isApproved: false },
  ]);

  await db.insert(abandonedCarts).values([
    { storeId, visitorId: "d-dev1", phone: "01098765432", name: "مريم", items: [{ productId: prods[1]!.id, name: prods[1]!.name, qty: 1, unitPiasters: prods[1]!.pricePiasters }], subtotalPiasters: prods[1]!.pricePiasters, lastSeenAt: new Date(now - 5 * 3600e3) },
    { storeId, visitorId: "d-dev2", phone: "01123456789", name: null, items: [{ productId: prods[6]!.id, name: prods[6]!.name, qty: 2, unitPiasters: prods[6]!.pricePiasters }], subtotalPiasters: prods[6]!.pricePiasters * 2, lastSeenAt: new Date(now - 26 * 3600e3) },
  ]);

  const events: (typeof analyticsEvents.$inferInsert)[] = [];
  for (let d = 0; d < 60; d++) {
    const visitors = 18 + Math.floor(rnd() * 30) + (d < 30 ? 10 : 0);
    for (let v = 0; v < visitors; v++) {
      const vid = `d-${d}-${v}`;
      const at = new Date(now - d * DAY - rnd() * DAY * 0.9);
      // مصادر واقعية: روابط فيسبوك وإنستاجرام وواتساب وحملات utm وبحث جوجل، والباقي مباشر.
      const r = rnd();
      const src = r < 0.3 ? { referrer: "https://l.facebook.com/" } : r < 0.42 ? { referrer: "https://l.instagram.com/" } : r < 0.55 ? { utmSource: "whatsapp", referrer: "" } : r < 0.62 ? { referrer: "https://www.google.com/" } : r < 0.66 ? { utmSource: "tiktok", referrer: "" } : { referrer: "" };
      events.push({ storeId, visitorId: vid, sessionId: vid, name: "page_view", path: "/", device: rnd() > 0.25 ? "mobile" : "desktop", createdAt: at, ...src });
      if (rnd() > 0.45) events.push({ storeId, visitorId: vid, sessionId: vid, name: "product_view", productId: pick(prods).id, createdAt: at });
      if (rnd() > 0.82) events.push({ storeId, visitorId: vid, sessionId: vid, name: "add_to_cart", createdAt: at });
      if (rnd() > 0.92) events.push({ storeId, visitorId: vid, sessionId: vid, name: "begin_checkout", createdAt: at });
    }
  }
  for (let i = 0; i < events.length; i += 500) await db.insert(analyticsEvents).values(events.slice(i, i + 500));

  const token = "dev-merchant-session-token-0000000000000000";
  await db.delete(sessions).where(eq(sessions.tokenHash, sha(token)));
  await db.insert(sessions).values({ tokenHash: sha(token), subjectType: "merchant", subjectId: m!.id, storeId, expiresAt: new Date(now + 30 * DAY) });
  console.log(`✓ متجر nova (${storeId}) بـ ${prods.length} منتجات و46 طلباً و${events.length} حدث زيارة`);
  console.log(`clp_m=${token}`);
}

main().catch((e) => {
  console.error("✗", e);
  process.exit(1);
});
