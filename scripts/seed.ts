import "dotenv/config";
import crypto from "node:crypto";
import { db } from "../src/db/client";
import { merchants, stores, storeBlueprints, categories, products, shippingZones } from "../src/db/schema";
import { defaultBlueprint } from "../src/blueprint/defaults";
import { defaultShippingZones } from "../src/lib/egypt";
import { buildSearchText, slugify } from "../src/lib/arabic";

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");

  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 100_000, 64, "sha512", (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(`${salt}:${derivedKey.toString("hex")}`);
    });
  });
}

async function main() {
  const [m] = await db
    .insert(merchants)
    .values({
      displayName: "تاجر تجريبي",
      username: "demo",
      passwordHash: await hashPassword("demo1234"),
      isActivated: true,
      phone: "01012345678",
    })
    .onConflictDoNothing()
    .returning();

  if (!m) {
    console.log("التاجر التجريبي موجود بالفعل.");
    return;
  }

  const [s] = await db
    .insert(stores)
    .values({
      merchantId: m.id,
      subdomain: "demo",
      name: "متجر ديمو التجريبي",
      status: "active",
      activatedAt: new Date(),
    })
    .returning();

  const bp = defaultBlueprint({
    name: "متجر ديمو التجريبي",
    tagline: "أزياء عصرية وخامات ممتازة بأسعار تريحك",
    industry: "fashion",
    vodafoneCash: "01012345678",
    inspectionAllowed: true,
  });

  await db.insert(storeBlueprints).values({ storeId: s!.id, data: bp });
  await db.insert(shippingZones).values(defaultShippingZones().map((z) => ({ ...z, storeId: s!.id })));

  const [c1, c2] = await db
    .insert(categories)
    .values([
      { storeId: s!.id, name: "فساتين", slug: "فساتين", sortOrder: 0 },
      { storeId: s!.id, name: "أحذية", slug: "احذيه", sortOrder: 1 },
    ])
    .returning();

  const items = [
    ["فستان صيفي كتان", 45000, 59900, c1!.id, ["جديد"], 25000],
    ["فستان سواريه أسود", 89900, null, c1!.id, ["الأكثر طلباً"], 45000],
    ["حذاء رياضي أبيض", 69900, 85000, c2!.id, [], 35000],
    ["صندل جلد طبيعي", 39900, null, c2!.id, ["عرض خاص"], 20000],
  ] as const;

  await db.insert(products).values(
    items.map(([name, price, cmp, cat, badges, cost], i) => ({
      storeId: s!.id,
      categoryId: cat,
      name,
      slug: slugify(name),
      pricePiasters: price,
      compareAtPiasters: cmp,
      costPiasters: cost,
      stock: 15 + i,
      shortDescription: "خامة ممتازة ومريحة طوال اليوم مع إمكانية الفحص قبل الاستلام",
      description: "## المواصفات والتفاصيل\n\n- خامة قطنية أصلية 100%\n- معاينة وفحص الشحنة متاحة مع المندوب قبل الدفع\n- استبدال سهل وسريع خلال 14 يوماً",
      badges: [...badges],
      isFeatured: i < 2,
      searchText: buildSearchText([name, "خامة ممتازة"]),
      images: [{ url: `https://picsum.photos/seed/${i + 20}/900/900` }],
    }))
  );

  console.log("✅ تم تجهيز المتجر التجريبي بنجاح: http://demo.localhost:3000 | دخول الأدمن: demo / demo1234");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });