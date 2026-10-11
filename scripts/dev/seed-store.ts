// seed-store.ts — يزرع متجراً من مجلده في stores/<slug>/ في القاعدة المحلية للمعاينة (لا الإنتاج أبداً):
// blueprint.json (وإلا Blueprint افتراضي باسم المتجر) وseed.json (الأقسام والمنتجات)، بحالة "active" واستضافة سارية.
// صور brief/assets/ تُضمَّن كـ data URI حتى تظهر بلا رفع. يعيد الزرع من الصفر في كل تشغيل.
//
//   bash scripts/dev/preview.sh store <slug>     ثم افتح http://<slug>.localhost:3100
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "../../src/db/schema";
import { blueprintSchema, type StoreBlueprint } from "../../src/blueprint/schema";
import { defaultBlueprint } from "../../src/blueprint/defaults";
import { defaultShippingZones } from "../../src/lib/egypt";
import { buildSearchText, slugify } from "../../src/lib/arabic";
import { storeSeedSchema, type SeedProduct } from "../../src/stores/seed";

const { merchants, stores, storeBlueprints, categories, products, productVariants, shippingZones } = schema;
const DAY = 864e5;
const MIME: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".avif": "image/avif", ".svg": "image/svg+xml", ".gif": "image/gif" };

function placeholder(name: string, i: number): string {
  const h = [18, 200, 330, 150, 45, 260][i % 6];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 750"><rect width="600" height="750" fill="hsl(${h} 40% 70%)"/><text x="300" y="430" font-family="sans-serif" font-size="200" font-weight="700" text-anchor="middle" fill="rgba(255,255,255,.85)">${name.charAt(0)}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/** رابط https كما هو، أو ملف داخل مجلد المتجر يُضمَّن (لا خروج من المجلد). */
function imageUrl(dir: string, ref: string): string | null {
  if (/^https:\/\//.test(ref)) return ref;
  const file = normalize(join(dir, ref));
  if (!file.startsWith(dir) || !existsSync(file)) return null;
  const mime = MIME[extname(file).toLowerCase()];
  return mime ? `data:${mime};base64,${readFileSync(file).toString("base64")}` : null;
}

function combos(options: Record<string, string[]>): string[][] {
  return Object.values(options).reduce<string[][]>((acc, vals) => acc.flatMap((a) => vals.map((v) => [...a, v])), [[]]);
}

async function main() {
  const slug = process.argv[2];
  if (!slug) throw new Error("الاستخدام: seed-store.ts <slug>");
  const url = process.env.DATABASE_URL;
  if (!url || !/@[^/]+\.local\.neon\//.test(url)) throw new Error("للمعاينة المحلية فقط: شغّله عبر scripts/dev/preview.sh store <slug>");
  const dir = join(process.cwd(), "stores", slug);
  if (!existsSync(join(dir, "store.json"))) throw new Error(`stores/${slug}/store.json غير موجود`);
  const meta = JSON.parse(readFileSync(join(dir, "store.json"), "utf8")) as { name: string };
  const db = drizzle({ client: neon(url), schema, casing: "snake_case" });

  const old = await db.select().from(stores).where(eq(stores.subdomain, slug)).limit(1);
  if (old[0]) {
    await db.delete(stores).where(eq(stores.id, old[0].id));
    await db.delete(merchants).where(eq(merchants.id, old[0].merchantId));
  }
  const now = Date.now();
  const [m] = await db.insert(merchants).values({ displayName: meta.name, email: `${slug}.dev@example.com`, isActivated: true }).returning();
  const [s] = await db
    .insert(stores)
    .values({ merchantId: m!.id, subdomain: slug, name: meta.name, status: "active", activatedAt: new Date(now), hostingExpiresAt: new Date(now + 365 * DAY) })
    .returning();
  const storeId = s!.id;

  let bp: StoreBlueprint;
  if (existsSync(join(dir, "blueprint.json"))) {
    bp = blueprintSchema.parse(JSON.parse(readFileSync(join(dir, "blueprint.json"), "utf8")));
  } else {
    bp = defaultBlueprint({ name: meta.name, storeId });
  }
  await db.insert(storeBlueprints).values({ storeId, data: bp });
  await db.insert(shippingZones).values(defaultShippingZones().map((z) => ({ ...z, storeId })));

  const seed = existsSync(join(dir, "seed.json")) ? storeSeedSchema.parse(JSON.parse(readFileSync(join(dir, "seed.json"), "utf8"))) : { categories: [], products: [] };
  const catNames = [...new Set([...seed.categories.map((c) => c.name), ...seed.products.map((p) => p.category).filter((c): c is string => Boolean(c))])];
  const cats = catNames.length
    ? await db
        .insert(categories)
        .values(catNames.map((name, i) => ({ storeId, name, slug: slugify(name), sortOrder: i, imageUrl: (() => { const ref = seed.categories.find((c) => c.name === name)?.image; return ref ? imageUrl(dir, ref) : null; })() })))
        .returning()
    : [];
  const catId = (name?: string) => cats.find((c) => c.name === name)?.id ?? null;

  let i = 0;
  for (const p of seed.products as SeedProduct[]) {
    const imgs = p.images.map((r) => imageUrl(dir, r)).filter((u): u is string => Boolean(u));
    const optionNames = p.options ? Object.keys(p.options) : [];
    const [row] = await db
      .insert(products)
      .values({
        storeId, categoryId: catId(p.category), name: p.name, slug: slugify(p.name), pricePiasters: Math.round(p.price * 100),
        compareAtPiasters: p.compareAt ? Math.round(p.compareAt * 100) : null, stock: p.stock ?? null, trackStock: p.stock !== undefined,
        status: "active", isFeatured: p.featured, sortOrder: i, description: p.description ?? null,
        images: (imgs.length ? imgs : [placeholder(p.name, i)]).map((url) => ({ url, alt: p.name })),
        searchText: buildSearchText([p.name, p.category ?? ""]), optionNames,
      })
      .returning();
    if (p.options) await db.insert(productVariants).values(combos(p.options).map((optionValues) => ({ storeId, productId: row!.id, optionValues, stock: null })));
    i++;
  }
  console.log(`✓ ${slug}: ${seed.products.length} منتج و${cats.length} قسم — http://${slug}.localhost:3100`);
}

main().catch((e) => {
  console.error("✗", e instanceof Error ? e.message : e);
  process.exit(1);
});
