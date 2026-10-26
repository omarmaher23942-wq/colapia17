import "server-only";
// setup-data.ts — قراءات خادم مشتركة لمسار الإعداد (ليست نقاط استدعاء عامة، فتقبل معرّف المتجر من الخادم فقط).
import { and, count, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { getTenantDb } from "@/db/tenant";
import { categories, discounts, products, shippingZones, storeBlueprints, type stores } from "@/db/schema";
import { blueprintSchema, type StoreBlueprint } from "@/blueprint/schema";
import { pairIdFor, parseOnboarding, planFromZones, publishReadiness, templateFromReturns, type ReadinessItem, type SetupData } from "@/lib/onboarding";
import { publicStoreUrl } from "@/lib/utils";
import { resolveNiche, usesSizeColor } from "@/lib/niche-attributes";
import { qualityTips, type QualityTip } from "@/lib/store-quality";
import { recipeFor } from "@/server/setup-recipe-data";

export async function loadBlueprint(storeId: string): Promise<StoreBlueprint | null> {
  const [row] = await db.select().from(storeBlueprints).where(eq(storeBlueprints.storeId, storeId)).limit(1);
  const p = row ? blueprintSchema.safeParse(row.data) : null;
  return p?.success ? p.data : null;
}

export async function readinessFor(storeId: string): Promise<{ ok: boolean; items: ReadinessItem[]; blockers: ReadinessItem[] } | null> {
  const bp = await loadBlueprint(storeId);
  if (!bp) return null;
  const tdb = await getTenantDb(storeId);
  const live = and(eq(products.storeId, storeId), isNull(products.deletedAt));
  const [[active], [draft], [zones]] = await Promise.all([
    tdb.select({ n: count() }).from(products).where(and(live, eq(products.status, "active"), gt(products.pricePiasters, 0))),
    tdb.select({ n: count() }).from(products).where(and(live, eq(products.status, "draft"))),
    tdb.select({ n: count() }).from(shippingZones).where(and(eq(shippingZones.storeId, storeId), eq(shippingZones.isActive, true))),
  ]);
  return publishReadiness({
    activePricedProducts: Number(active?.n ?? 0),
    draftProducts: Number(draft?.n ?? 0),
    payments: bp.payments,
    activeZones: Number(zones?.n ?? 0),
    whatsapp: bp.channels.whatsappNumber,
    storeName: bp.brand.name,
  });
}

/** اقتراحات الجودة قبل النشر من بيانات المتجر الفعلية (غير مانعة). */
export async function qualityFor(store: typeof stores.$inferSelect): Promise<QualityTip[]> {
  const bp = await loadBlueprint(store.id);
  if (!bp) return [];
  const tdb = await getTenantDb(store.id);
  const live = and(eq(products.storeId, store.id), isNull(products.deletedAt), eq(products.status, "active"));
  const [[row], [cats]] = await Promise.all([
    tdb
      .select({
        active: count(),
        noImage: sql<number>`count(*) filter (where jsonb_array_length(coalesce(${products.images}, '[]'::jsonb)) = 0)`,
        noDesc: sql<number>`count(*) filter (where coalesce(nullif(trim(${products.description}), ''), nullif(trim(${products.shortDescription}), '')) is null)`,
      })
      .from(products)
      .where(live),
    tdb.select({ n: count() }).from(categories).where(eq(categories.storeId, store.id)),
  ]);
  return qualityTips({
    hasLogo: Boolean(bp.brand.logo?.url),
    activeProducts: Number(row?.active ?? 0),
    withoutImage: Number(row?.noImage ?? 0),
    withoutDescription: Number(row?.noDesc ?? 0),
    categories: Number(cats?.n ?? 0),
    usesSizes: usesSizeColor(resolveNiche(store.onboarding, bp.brand.tagline, bp.brand.description, bp.brand.name)),
    sizeGuideCharts: bp.sizeGuide.charts.length,
  });
}

/** يجمع حالة الإعداد الحية لصفحة /onboarding من بيانات المتجر الفعلية (لا مسودة منفصلة). */
export async function loadSetupData(store: typeof stores.$inferSelect): Promise<SetupData | null> {
  const bp = await loadBlueprint(store.id);
  if (!bp) return null;
  const tdb = await getTenantDb(store.id);
  const live = and(eq(products.storeId, store.id), isNull(products.deletedAt));
  const [[total], [active], [draft], cats, zones, [disc], readiness, missing] = await Promise.all([
    tdb.select({ n: count() }).from(products).where(live),
    tdb.select({ n: count() }).from(products).where(and(live, eq(products.status, "active"), gt(products.pricePiasters, 0))),
    tdb.select({ n: count() }).from(products).where(and(live, eq(products.status, "draft"))),
    tdb.select({ name: categories.name }).from(categories).where(eq(categories.storeId, store.id)).orderBy(categories.sortOrder),
    tdb.select().from(shippingZones).where(eq(shippingZones.storeId, store.id)),
    tdb.select({ n: count() }).from(discounts).where(eq(discounts.storeId, store.id)),
    readinessFor(store.id),
    tdb
      .select({ id: products.id, name: products.name, images: products.images })
      .from(products)
      .where(and(live, sql`(${products.status} = 'draft' or ${products.pricePiasters} <= 0)`))
      .orderBy(products.sortOrder)
      .limit(40),
  ]);
  const onboarding = parseOnboarding(store.onboarding);
  const restored = planFromZones(zones, bp.shipping.flatRatePiasters);
  const hero = bp.home.find((s) => s.type === "hero");
  const codFeeP = Number((store.onboarding as { codFee?: number }).codFee ?? zones.find((z) => z.codExtraPiasters > 0)?.codExtraPiasters ?? 0);
  const url = publicStoreUrl(store);
  const p = bp.payments;
  const c = bp.channels;
  const base: Omit<SetupData, "recipe"> = {
    store: { id: store.id, name: bp.brand.name, subdomain: store.subdomain, url, host: url.replace(/^https?:\/\//, ""), trialEndsAt: store.trialEndsAt?.toISOString() ?? null },
    onboarding,
    identity: { name: bp.brand.name, primary: bp.theme.palette.primary, fontPair: pairIdFor(bp.theme.fonts.heading, bp.theme.fonts.body), logoUrl: bp.brand.logo?.url ?? null },
    products: { total: Number(total?.n ?? 0), active: Number(active?.n ?? 0), drafts: Number(draft?.n ?? 0), categories: cats.map((x) => x.name), missing: missing.map((m) => ({ id: m.id, name: m.name, image: m.images?.[0]?.url ?? null })) },
    payments: {
      cod: p.cod.enabled,
      inspection: bp.shipping.inspectionAllowed,
      codFee: codFeeP / 100,
      vodafone: { enabled: p.vodafoneCash.enabled, number: p.vodafoneCash.number ?? "", holder: p.vodafoneCash.holderName ?? "" },
      instapay: { enabled: p.instapay.enabled, target: p.instapay.address ?? p.instapay.number ?? "", holder: p.instapay.holderName ?? "" },
    },
    shipping: restored
      ? { ...restored, freeOver: bp.shipping.freeOverPiasters ? bp.shipping.freeOverPiasters / 100 : null, saved: true }
      : { plan: { kind: "cairo_giza", cairoFee: 50, restFee: 75 }, etaMin: 2, etaMax: 4, freeOver: null, saved: false },
    returns: templateFromReturns(bp.returns),
    extras: { gift: bp.shipping.giftEnabled === true, giftFeePounds: (bp.shipping.giftWrapPiasters ?? 0) / 100, customerCancel: bp.returns.allowCustomerCancel === true },
    contact: { whatsapp: c.whatsappNumber ?? "", instagram: c.instagramUsername ?? "", facebook: c.facebookUrl ?? "", tiktok: c.tiktokUsername ?? "" },
    look: {
      heroKind: hero && hero.type === "hero" ? (hero.videoUrl ? "video" : hero.images.length ? "image" : "auto") : "auto",
      hasVideo: Boolean(hero && hero.type === "hero" && hero.videoUrl),
      videoUrl: hero && hero.type === "hero" ? (hero.videoUrl ?? null) : null,
      themeId: typeof (store.onboarding as { themeId?: unknown }).themeId === "string" ? ((store.onboarding as { themeId: string }).themeId) : null,
      templateId: typeof (store.onboarding as { templateId?: unknown }).templateId === "string" ? ((store.onboarding as { templateId: string }).templateId) : null,
    },
    niche: resolveNiche(store.onboarding, bp.brand.tagline, bp.brand.description, bp.brand.name),
    discounts: Number(disc?.n ?? 0),
    readiness: readiness ? { ok: readiness.ok, items: readiness.items } : { ok: false, items: [] },
  };
  return { ...base, recipe: await recipeFor(store, base) };
}
