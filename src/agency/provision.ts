import "server-only";
// provision.ts — «جهّز المتجر» (المرحلة 4): من طلب مُسند إلى متجر يعمل على <slug>.colapia.com خلف بوابة «قيد
// التجهيز» خلال ثوانٍ، بمسودة أولى من الاستمارة (draft.ts) ومنتجاته المسعّرة، ثم مجلد stores/<slug>/ في فرع بناء.
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
import { blueprintSchema } from "@/blueprint/schema";
import type { StoreSeed } from "@/stores/seed";
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
  const catNames = [...new Set(seed.products.map((p) => p.category).filter((c): c is string => Boolean(c)))];
  const cats = catNames.length ? await tdb.insert(categories).values(catNames.map((name, i) => ({ storeId, name, slug: slugify(name) || `cat-${i + 1}`, sortOrder: i }))).returning({ id: categories.id, name: categories.name }) : [];
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
        images: p.images.map((url) => ({ url, alt: p.name })),
        searchText: buildSearchText([p.name, p.category ?? "", p.description ?? ""]),
        optionNames: p.options ? Object.keys(p.options) : [],
      })
      .returning({ id: products.id });
    if (p.options && row) {
      await tdb.insert(productVariants).values(combos(p.options).slice(0, 200).map((optionValues) => ({ storeId, productId: row.id, optionValues, stock: null })));
    }
  }
}

export type ProvisionResult = { ok: true; storeId: string; draft: Draft; files: Record<string, string> } | { ok: false; error: string };

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

  const bp = blueprintSchema.parse(draft.blueprint);
  await db.insert(storeBlueprints).values({ storeId, data: bp, updatedBy: "agency:provision" });
  await (await getTenantDb(storeId)).insert(shippingZones).values(zonesFor(d.delivery, storeId));
  await seedCatalog(storeId, draft.seed);
  return { ok: true, storeId, draft, files };
}

export const provisionBranch = (slug: string, round: number) => branchFor(slug, round);
