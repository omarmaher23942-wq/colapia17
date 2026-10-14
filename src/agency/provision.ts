import "server-only";
// provision.ts — «جهّز المتجر» (المرحلة 4): من طلب مُسند إلى متجر يعمل على <slug>.colapia.com خلف بوابة «قيد
// التجهيز» خلال ثوانٍ، بمسودة أولى من الاستمارة (draft.ts) ومنتجاته المسعّرة، ثم مجلد stores/<slug>/ في فرع بناء.
// وإن كان الفريق بنى مجلد stores/<slug>/ ونُشر قبل التجهيز، يُزرع blueprint.json وseed.json منه كما هما بدل المسودة
// (التصميم والنصوص والمنتجات التي راجعها الفريق)، وتبقى مناطق الشحن من إجابات الاستمارة.
//
// الترتيب آمن لإعادة المحاولة: المتجر يُنشأ بالنطاق (فريد) ثم يُربط بالطلب بشرط storeId IS NULL؛ إن سبق تجهيز
// متزامن يُحذف المتجر الزائد. الكتالوج يُزرع في db.batch واحد. فشل GitHub لا يُفشل التجهيز (ZIP بديل).
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { getTenantDb } from "@/db/tenant";
import { categories, merchants, productVariants, products, shippingZones, storeBlueprints, stores } from "@/db/schema";
import { storeRequests } from "@/db/schema/agency";
import { buildSearchText, slugify } from "@/lib/arabic";
import { normalizeEgyptianPhone } from "@/lib/phone";
import { dbErrorInfo, PG_UNIQUE } from "@/lib/db-errors";
import { readData, requestAssets, type RequestRow } from "@/intake/repo";
import type { IntakeData } from "@/intake/schema";
import { renderBrief } from "@/intake/brief";
import { isTrustedUploadUrl } from "@/lib/upload-hosts";
import { blueprintSchema, type StoreBlueprint } from "@/blueprint/schema";
import { storeSeedSchema, type StoreSeed } from "@/stores/seed";
import { storeFolderData } from "@/stores/resolve";
import { buildDraft, storeFolderFiles, type Draft } from "./draft";
import { branchFor } from "./prompt";
import { zoneRows } from "./policies";


const combos = (options: Record<string, string[]>): string[][] =>
  Object.values(options).reduce<string[][]>((acc, vals) => acc.flatMap((a) => vals.map((v) => [...a, v])), [[]]);

/** مناطق الشحن حسب اختيار العميل: النطاق والسعر الموحد ومدة التوصيل (agency/policies.ts). */
const zonesFor = (delivery: IntakeData["delivery"], storeId: string) => zoneRows(delivery).map((z) => ({ ...z, storeId }));

async function seedCatalog(storeId: string, seed: StoreSeed) {
  const tdb = await getTenantDb(storeId);
  const usedSlugs = new Set<string>();
  const uniqueSlug = (name: string) => {
    const base = slugify(name) || "product";
    let s = base;
    for (let i = 2; usedSlugs.has(s); i++) s = `${base}-${i}`;
    usedSlugs.add(s);
    return s;
  };
  // صور المتجر على الإنتاج روابط https فقط (مسارات brief/assets/ محلية لا تُعرض هنا).
  const https = (u: string | undefined) => (u && /^https:\/\//i.test(u) ? u : null);
  // الأقسام بترتيب seed.categories وصورها، ثم أي قسم تذكره المنتجات وحدها.
  const catList = [...seed.categories];
  for (const c of seed.products.map((p) => p.category)) if (c && !catList.some((x) => x.name === c)) catList.push({ name: c });
  const usedCatSlugs = new Set<string>();
  const catSlug = (name: string, i: number) => {
    const base = slugify(name) || `cat-${i + 1}`;
    let s = base;
    for (let n = 2; usedCatSlugs.has(s); n++) s = `${base}-${n}`;
    usedCatSlugs.add(s);
    return s;
  };
  const cats = catList.length
    ? await tdb
        .insert(categories)
        .values(catList.map((c, i) => ({ storeId, name: c.name, slug: catSlug(c.name, i), sortOrder: i, imageUrl: https(c.image) })))
        .returning({ id: categories.id, name: categories.name })
    : [];
  for (const [i, p] of seed.products.entries()) {
    const [row] = await tdb
      .insert(products)
      .values({
        storeId,
        categoryId: cats.find((c) => c.name === p.category)?.id ?? null,
        name: p.name,
        slug: uniqueSlug(p.name),
        pricePiasters: Math.round(p.price * 100),
        compareAtPiasters: p.compareAt ? Math.round(p.compareAt * 100) : null,
        stock: p.stock ?? null,
        trackStock: p.stock !== undefined,
        status: "active",
        isFeatured: p.featured,
        sortOrder: i,
        description: p.description ?? null,
        images: p.images.filter((url) => https(url)).map((url) => ({ url, alt: p.name })),
        searchText: buildSearchText([p.name, p.category ?? "", p.description ?? ""]),
        optionNames: p.options ? Object.keys(p.options) : [],
      })
      .returning({ id: products.id });
    if (p.options && row) {
      await tdb.insert(productVariants).values(combos(p.options).slice(0, 200).map((optionValues) => ({ storeId, productId: row.id, optionValues, stock: null })));
    }
  }
}

export type ProvisionResult =
  | {
      ok: true;
      storeId: string;
      draft: Draft;
      files: Record<string, string>;
      /** folder = من مجلد stores/<slug>/ المنشور، draft = المسودة الآلية من الاستمارة. */
      source: "folder" | "draft";
      products: number;
      /** منتجات الاستمارة بلا سعر (أسئلة DELIVERY.md)؛ صفر حين يُزرع seed.json الذي راجعه الفريق. */
      missingPrice: number;
    }
  | { ok: false; error: string };

/** ما بناه الفريق في stores/<slug>/ ونُشر مع الكود (السجل المولَّد)، بعد فحصه بمخططيه؛ ما لا يصلح = null فتُستخدم المسودة. */
async function folderData(slug: string): Promise<{ blueprint: StoreBlueprint | null; seed: StoreSeed | null }> {
  const raw = await storeFolderData(slug).catch(() => ({ blueprint: null, seed: null }));
  const bp = raw.blueprint ? blueprintSchema.safeParse(raw.blueprint) : null;
  const seed = raw.seed ? storeSeedSchema.safeParse(raw.seed) : null;
  return { blueprint: bp?.success ? bp.data : null, seed: seed?.success ? seed.data : null };
}

export async function prepareFolder(row: RequestRow, slug: string): Promise<{ draft: Draft; files: Record<string, string> }> {
  const d = readData(row.data);
  const assets = await requestAssets(row.id);
  const byKey = new Map(assets.map((a) => [a.key, a]));
  const imageUrl = (key: string | undefined) => {
    const u = key ? byKey.get(key)?.url : undefined;
    return u && isTrustedUploadUrl(u) ? u : null;
  };
  const draft = buildDraft({ slug, code: row.code, data: d, imageUrl });
  const brief = renderBrief({ code: row.code, data: d, assets: assets.filter((a) => a.kind === "image" || a.kind === "logo").map((a) => ({ key: a.key, url: a.url, kind: a.kind as "image" | "logo" })), submittedAt: row.submittedAt });
  const files = storeFolderFiles({
    slug,
    code: row.code,
    name: d.store.name?.trim() || slug,
    brief,
    draft,
    assets: assets.filter((a) => isTrustedUploadUrl(a.url)).map((a) => ({ kind: a.kind, url: a.url })),
  });
  return { draft, files };
}

/** ينشئ التاجر والمتجر ويزرع المسودة. يفترض أن المستدعي تحقق من الصلاحية وحالة الطلب. */
export async function provisionStore(row: RequestRow, slug: string): Promise<ProvisionResult> {
  if (row.storeId) return { ok: false, error: "جُهِّز هذا الطلب بالفعل." };
  const d = readData(row.data);
  const { draft, files } = await prepareFolder(row, slug);
  const folder = await folderData(slug);
  const name = d.store.name?.trim() || slug;

  // التاجر = صاحب بريد الاستمارة (المرحلة 6: يدخل لوحته بهذا البريد). نفس البريد بطلب ثانٍ = نفس التاجر.
  const email = row.email;
  let merchantId = row.merchantId;
  if (!merchantId && email) {
    const [m] = await db.select({ id: merchants.id }).from(merchants).where(eq(merchants.email, email)).limit(1);
    merchantId = m?.id ?? null;
  }
  if (!merchantId) {
    const [m] = await db
      .insert(merchants)
      .values({ displayName: name, email: email ?? null, phone: normalizeEgyptianPhone(row.whatsapp ?? null) })
      .returning({ id: merchants.id });
    merchantId = m!.id;
  }

  let storeId: string;
  try {
    const [s] = await db.insert(stores).values({ merchantId, subdomain: slug, name, status: "building" }).returning({ id: stores.id });
    storeId = s!.id;
  } catch (e) {
    if (dbErrorInfo(e).code === PG_UNIQUE) return { ok: false, error: "النطاق مستخدم لمتجر آخر. غيّره ثم أعد التجهيز." };
    throw e;
  }

  // ربط الطلب بالمتجر مرة واحدة فقط (تجهيزان متزامنان: الثاني يحذف متجره).
  const [linked] = await db
    .update(storeRequests)
    .set({ storeId, merchantId, slug, updatedAt: new Date() })
    .where(and(eq(storeRequests.id, row.id), isNull(storeRequests.storeId)))
    .returning({ id: storeRequests.id });
  if (!linked) {
    await db.delete(stores).where(eq(stores.id, storeId));
    return { ok: false, error: "جهّزه عضو آخر للتو. حدّث الصفحة." };
  }

  const bp = folder.blueprint ?? blueprintSchema.parse(draft.blueprint);
  const seed = folder.seed ?? draft.seed;
  await db.insert(storeBlueprints).values({ storeId, data: bp, updatedBy: folder.blueprint ? "agency:folder" : "agency:provision" });
  await (await getTenantDb(storeId)).insert(shippingZones).values(zonesFor(d.delivery, storeId));
  await seedCatalog(storeId, seed);
  return {
    ok: true,
    storeId,
    draft,
    files,
    source: folder.blueprint || folder.seed ? "folder" : "draft",
    products: seed.products.length,
    missingPrice: folder.seed ? 0 : draft.missingPrice.length,
  };
}

export const provisionBranch = (slug: string, round: number) => branchFor(slug, round);
