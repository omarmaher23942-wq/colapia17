// export-store-files.ts — يولّد stores/demo/blueprint.json وseed.json من بيانات الديمو نفسها (مصدر واحد: scripts/demo/data/fashion.json
// وcatalog.ts)، فيطابقان ما يزرعه seed-demo.ts. معرّفات الأقسام في جداول المقاسات رموز مؤقتة (الزرع الفعلي يستبدلها بمعرّفات القاعدة).
//
// الاستخدام: npx tsx scripts/demo/export-store-files.ts
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildDemoBlueprint, demoCategories, fakeCategoryIds, loadDemoProducts, variantsOf } from "./catalog";

const root = process.cwd();
const data = loadDemoProducts();
const bp = buildDemoBlueprint({ storeId: "00000000-0000-4000-8000-0000000000aa", email: "demo@colapia.com", categoryIds: fakeCategoryIds(data), productCount: data.length, data });
writeFileSync(join(root, "stores/demo/blueprint.json"), JSON.stringify(bp, null, 2) + "\n");

const seed = {
  categories: demoCategories(data).map((c) => ({ name: c.name })),
  products: data.map((p) => ({
    name: p.name,
    price: p.price,
    ...(p.compareAt ? { compareAt: p.compareAt } : {}),
    stock: variantsOf(p).reduce((a, v) => a + v.stock, 0) || p.stock,
    category: demoCategories(data).find((c) => c.name === p.category)?.name ?? p.category,
    description: p.shortDescription,
    images: p.images,
    featured: p.featured,
    options: Object.fromEntries(p.options.map((o) => [o.name, o.values])),
  })),
};
writeFileSync(join(root, "stores/demo/seed.json"), JSON.stringify(seed, null, 2) + "\n");
console.log(`✓ blueprint.json وseed.json (${seed.products.length} منتجاً)`);
