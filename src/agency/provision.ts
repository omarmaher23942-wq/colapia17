import "server-only";
// provision.ts — «جهّز المتجر» (V5 N6): من طلب بناء الوكيل (store_requests، status submitted) إلى متجر بحالة 'setup' مخفي عن الزوار،
// بلا عدّاد (beginPreviewClock يبدؤه عند أول فتح لرابط الإعداد). المصدر: مجلد stores/<slug>/ إن وُجد وصحّ، وإلا مخطط افتراضي صادق.
// آمن للإعادة والتزامن: المتجر يُنشأ بنطاق فريد ثم يُربط بالطلب بشرط storeId IS NULL؛ الخاسر يحذف متجره.
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { getTenantDb } from "@/db/tenant";
import { categories, merchants, productVariants, products, shippingZones, storeBlueprints, stores } from "@/db/schema";
import { storeRequests } from "@/db/schema/agency";
import { blueprintSchema } from "@/blueprint/schema";
import { buildSearchText, slugify } from "@/lib/arabic";
import { dbErrorInfo, PG_UNIQUE } from "@/lib/db-errors";
import { normalizeEgyptianPhone } from "@/lib/phone";
import { storeSeedSchema, type StoreSeed } from "@/stores/seed";
import { storeFolderData } from "@/stores/resolve";
import { blueprintFromRequest, chooseSlug, isBuildData, pickSource, productionAfterProvision, zonesFromSelling, type ProvisionSource } from "./provision-plan";

export type ProvisionResult = { ok: true; storeId: string; slug: string; source: ProvisionSource; products: number } | { ok: false; error: string };

type Row = typeof storeRequests.$inferSelect;

const https = (u: string | undefined) => (u && /^https:\/\//i.test(u) ? u : null);
const combos = (o: Record<string, string[]>) => Object.values(o).reduce<string[][]>((acc, vals) => acc.flatMap((a) => vals.map((v) => [...a, v])), [[]]);

/** المنتجات التي لها صورة https واحدة على الأقل فقط (لا منتج بلا صورة). */
async function seedCatalog(storeId: string, seed: StoreSeed): Promise<number> {
  const list = seed.products.map((p) => ({ ...p, images: p.images.filter((u) => https(u)) })).filter((p) => p.images.length > 0);
  if (!list.length) return 0;
  const tdb = await getTenantDb(storeId);
  const used = new Set<string>();
  const uniq = (name: string, fb: string) => {
    const base = slugify(name) || fb;
    let s = base;
    for (let i = 2; used.has(s); i++) s = `${base}-${i}`;
    used.add(s);
    return s;
  };
  const names = [...seed.categories.map((c) => c.name)];
  for (const p of list) if (p.category && !names.includes(p.category)) names.push(p.category);
  const cats = names.length
    ? await tdb
        .insert(categories)
        .values(names.map((name, i) => ({ storeId, name, slug: uniq(`c-${name}`, `cat-${i + 1}`), sortOrder: i, imageUrl: https(seed.categories.find((c) => c.name === name)?.image) })))
        .returning({ id: categories.id, name: categories.name })
    : [];
  for (const [i, p] of list.entries()) {
    const [row] = await tdb
      .insert(products)
      .values({
        storeId,
        categoryId: cats.find((c) => c.name === p.category)?.id ?? null,
        name: p.name,
        slug: uniq(p.name, "product"),
        pricePiasters: Math.round(p.price * 100),
        compareAtPiasters: p.compareAt ? Math.round(p.compareAt * 100) : null,
        stock: p.stock ?? null,
        trackStock: p.stock !== undefined,
        status: "active",
        isFeatured: p.featured,
        sortOrder: i,
        description: p.description ?? null,
        images: p.images.map((url) => ({ url, alt: p.name })),
        searchText: buildSearchText([p.name, p.category ?? "", p.description ?? ""]),
        optionNames: p.options ? Object.keys(p.options) : [],
      })
      .returning({ id: products.id });
    if (p.options && row) await tdb.insert(productVariants).values(combos(p.options).slice(0, 200).map((optionValues) => ({ storeId, productId: row.id, optionValues, stock: null })));
  }
  return list.length;
}

async function folder(slug: string) {
  const raw = await storeFolderData(slug).catch(() => ({ blueprint: null, seed: null }));
  const bp = raw.blueprint ? blueprintSchema.safeParse(raw.blueprint) : null;
  const seed = raw.seed ? storeSeedSchema.safeParse(raw.seed) : null;
  return { blueprint: bp?.success ? bp.data : null, seed: seed?.success ? seed.data : null };
}

/** يفترض أن المستدعي تحقق من الصلاحية وأن الطلب submitted. */
export async function provisionFromRequest(row: Row, requestedSlug: string | null): Promise<ProvisionResult> {
  if (row.storeId) return { ok: false, error: "جُهِّز هذا الطلب بالفعل." };
  if (row.status !== "submitted") return { ok: false, error: "الطلب ليس في حالة تسمح بالتجهيز." };
  if (!isBuildData(row.data)) return { ok: false, error: "بيانات الطلب ليست من الوكيل ولا تُجهَّز تلقائياً." };
  const d = row.data;
  const name = (d.identity.storeName || row.storeName || "").trim();
  if (!name) return { ok: false, error: "اسم المتجر ناقص في الطلب." };

  const existing = await db.select({ s: stores.subdomain }).from(stores);
  const taken = new Set(existing.map((r) => r.s));
  const verdict = chooseSlug({ requested: requestedSlug ?? row.slug, storeName: name, instagram: d.identity.instagram, email: row.email, code: row.code }, (s) => taken.has(s));
  if (!verdict.ok) return verdict;
  const slug = verdict.slug;

  // التاجر = صاحب بريد الطلب (موجود يُعاد استخدامه). بلا بريد لا يمكن إصدار رابط إعداد يدخل به.
  const email = (row.email ?? d.contact.email ?? "").trim().toLowerCase() || null;
  if (!email) return { ok: false, error: "لا بريد في الطلب. أضيفوا بريد التاجر أولاً (يدخل به لوحته)." };
  let merchantId = row.merchantId;
  if (!merchantId) {
    const [m] = await db.select({ id: merchants.id }).from(merchants).where(eq(merchants.email, email)).limit(1);
    merchantId = m?.id ?? null;
  }
  if (!merchantId) {
    const [m] = await db.insert(merchants).values({ displayName: name, email, phone: normalizeEgyptianPhone(row.whatsapp ?? d.contact.whatsapp ?? null) }).returning({ id: merchants.id });
    merchantId = m!.id;
  }

  let storeId: string;
  try {
    const [s] = await db.insert(stores).values({ merchantId, subdomain: slug, name, status: "setup" }).returning({ id: stores.id });
    storeId = s!.id;
  } catch (e) {
    if (dbErrorInfo(e).code === PG_UNIQUE) return { ok: false, error: "النطاق مستخدم لمتجر آخر. غيّروه ثم أعيدوا التجهيز." };
    throw e;
  }

  const f = await folder(slug);
  const source = pickSource(f);
  const [linked] = await db
    .update(storeRequests)
    .set({ storeId, merchantId, slug, production: productionAfterProvision(source), productionChangedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(storeRequests.id, row.id), isNull(storeRequests.storeId)))
    .returning({ id: storeRequests.id });
  if (!linked) {
    await db.delete(stores).where(eq(stores.id, storeId));
    return { ok: false, error: "جهّزه عضو آخر للتو. حدّثوا الصفحة." };
  }

  try {
    const bp = f.blueprint ?? blueprintFromRequest(d);
    await db.insert(storeBlueprints).values({ storeId, data: bp, updatedBy: f.blueprint ? "agency:folder" : "agency:provision" });
    await (await getTenantDb(storeId)).insert(shippingZones).values(zonesFromSelling(d.selling.text).map((z) => ({ ...z, storeId })));
    const n = f.seed ? await seedCatalog(storeId, f.seed) : 0;
    return { ok: true, storeId, slug, source, products: n };
  } catch (e) {
    // فشل الزرع: نفك الربط ونحذف المتجر ليعيد الفريق المحاولة نظيفة.
    console.error("[provision] seed failed", e);
    await db.update(storeRequests).set({ storeId: null, updatedAt: new Date() }).where(eq(storeRequests.id, row.id)).catch(() => {});
    await db.delete(stores).where(eq(stores.id, storeId)).catch(() => {});
    return { ok: false, error: "تعذّر زرع بيانات المتجر. أعيدوا المحاولة." };
  }
}
