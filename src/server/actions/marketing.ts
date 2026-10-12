"use server";
// marketing.ts — إعدادات «التسويق» في لوحة التاجر: معرّفات البكسل وGA4 وتيك توك ووسم Search Console (في الـ Blueprint،
// منقّاة بـ lib/tracking.ts)، ورمز Conversions API من ميتا (سر في store_secrets لا يعود للواجهة إلا مقنّعاً).
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { categories, discounts, products, storeBlueprints } from "@/db/schema";
import { getTenantDb } from "@/db/tenant";
import { campaignSlug } from "@/lib/campaigns";
import { storeFor } from "@/server/merchant-guard";
import { blueprintSchema } from "@/blueprint/schema";
import { cleanCapiToken, cleanGa4, cleanGoogleVerification, cleanMetaPixel, cleanTiktokPixel } from "@/lib/tracking";
import { setMetaCapiToken } from "@/server/store-secrets";
import { saveBlueprintAction } from "./blueprint";

const schema = z.object({
  metaPixelId: z.string().max(200),
  gaMeasurementId: z.string().max(200),
  tiktokPixelId: z.string().max(300),
  googleVerification: z.string().max(300),
  /** undefined = يبقى كما هو، "" = يُحذف. */
  capiToken: z.string().max(600).optional(),
});

type Result = { ok: true } | { ok: false; error: string; field?: string };

export async function saveTrackingAction(raw: z.input<typeof schema>): Promise<Result> {
  const s = await storeFor("discounts");
  if (!s) return { ok: false, error: "إعدادات التسويق تحتاج صلاحية «الخصومات والحملات»." };
  const p = schema.safeParse(raw);
  if (!p.success) return { ok: false, error: "بيانات غير صالحة" };
  const d = p.data;

  const ids = {
    metaPixelId: cleanMetaPixel(d.metaPixelId),
    gaMeasurementId: cleanGa4(d.gaMeasurementId),
    tiktokPixelId: cleanTiktokPixel(d.tiktokPixelId),
    googleVerification: cleanGoogleVerification(d.googleVerification),
  };
  const bad = (k: keyof typeof ids, msg: string): Result | null => (d[k].trim() && !ids[k] ? { ok: false, error: msg, field: k } : null);
  const err =
    bad("metaPixelId", "معرّف بكسل ميتا رقم من 10 إلى 20 خانة (من مدير الأحداث).") ??
    bad("gaMeasurementId", "معرّف GA4 يبدأ بـ G- (من إعدادات مصدر البيانات).") ??
    bad("tiktokPixelId", "معرّف بكسل تيك توك حروف وأرقام إنجليزية (من مدير الأحداث في تيك توك).") ??
    bad("googleVerification", "الصق وسم التحقق من Search Console كما هو أو قيمة content وحدها.");
  if (err) return err;
  let token: string | null | undefined;
  if (d.capiToken !== undefined) {
    token = d.capiToken.trim() ? cleanCapiToken(d.capiToken) : null;
    if (d.capiToken.trim() && !token) return { ok: false, error: "رمز Conversions API غير صحيح: انسخه كاملاً من مدير الأحداث ← الإعدادات.", field: "capiToken" };
    if (token && !ids.metaPixelId) return { ok: false, error: "أضف معرّف بكسل ميتا أولاً: الرمز يعمل معه.", field: "metaPixelId" };
  }

  const [row] = await db.select().from(storeBlueprints).where(eq(storeBlueprints.storeId, s.storeId)).limit(1);
  const cur = row ? blueprintSchema.safeParse(row.data) : null;
  if (!cur?.success) return { ok: false, error: "تعذر قراءة إعدادات المتجر" };
  const seo = { ...cur.data.seo, metaPixelId: ids.metaPixelId ?? undefined, gaMeasurementId: ids.gaMeasurementId ?? undefined, tiktokPixelId: ids.tiktokPixelId ?? undefined, googleVerification: ids.googleVerification ?? undefined };
  const r = await saveBlueprintAction({ ...cur.data, seo }, "تعديل التتبع والإعلانات");
  if (!r.ok) return { ok: false, error: r.error };
  if (token !== undefined) await setMetaCapiToken(s.storeId, token);
  if (!ids.metaPixelId && token === undefined) await setMetaCapiToken(s.storeId, null);
  revalidatePath("/dashboard/marketing");
  return { ok: true };
}

// ─── روابط الحملات (المرحلة 9.4) ─────────────────────────────────────────

const campaignInput = z.object({
  slug: z.string().max(40).optional(),
  name: z.string().trim().min(2, "اكتب اسماً للحملة").max(60),
  platform: z.enum(["facebook", "instagram", "tiktok", "google", "whatsapp", "snapchat", "other"]),
  targetType: z.enum(["home", "product", "category"]),
  targetSlug: z.string().max(200).optional(),
  code: z.string().max(20).optional(),
});

async function currentBlueprint(storeId: string) {
  const [row] = await db.select().from(storeBlueprints).where(eq(storeBlueprints.storeId, storeId)).limit(1);
  const cur = row ? blueprintSchema.safeParse(row.data) : null;
  return cur?.success ? cur.data : null;
}

/** ينشئ حملة (بلا slug) أو يعدّلها (بالـ slug نفسه؛ الرابط لا يتغير بعد نشره). */
export async function saveCampaignAction(raw: z.input<typeof campaignInput>): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const s = await storeFor("discounts");
  if (!s) return { ok: false, error: "الحملات تحتاج صلاحية «الخصومات والحملات»." };
  const p = campaignInput.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "بيانات غير صالحة" };
  const d = p.data;
  const bp = await currentBlueprint(s.storeId);
  if (!bp) return { ok: false, error: "تعذر قراءة إعدادات المتجر" };

  const tdb = await getTenantDb(s.storeId);
  if (d.targetType !== "home") {
    if (!d.targetSlug) return { ok: false, error: d.targetType === "product" ? "اختر المنتج" : "اختر القسم" };
    const found =
      d.targetType === "product"
        ? await tdb.select({ id: products.id }).from(products).where(and(eq(products.storeId, s.storeId), eq(products.slug, d.targetSlug), isNull(products.deletedAt))).limit(1)
        : await tdb.select({ id: categories.id }).from(categories).where(and(eq(categories.storeId, s.storeId), eq(categories.slug, d.targetSlug))).limit(1);
    if (!found.length) return { ok: false, error: "الوجهة لم تعد موجودة في متجرك" };
  }
  const code = d.code?.trim().toUpperCase() || undefined;
  if (code) {
    const [dc] = await tdb.select({ id: discounts.id }).from(discounts).where(and(eq(discounts.storeId, s.storeId), eq(discounts.code, code))).limit(1);
    if (!dc) return { ok: false, error: "كود الخصم غير موجود" };
  }

  const existing = d.slug ? bp.campaigns.find((c) => c.slug === d.slug) : undefined;
  if (d.slug && !existing) return { ok: false, error: "الحملة غير موجودة" };
  if (!existing && bp.campaigns.length >= 40) return { ok: false, error: "وصلت لأقصى عدد من الحملات (40). احذف القديمة أولاً." };
  const slug = existing?.slug ?? campaignSlug(d.name, bp.campaigns.map((c) => c.slug));
  const campaign = {
    slug,
    name: d.name,
    platform: d.platform,
    target: d.targetType === "home" ? { type: "home" as const } : { type: d.targetType, slug: d.targetSlug },
    code,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
  const campaigns = existing ? bp.campaigns.map((c) => (c.slug === slug ? campaign : c)) : [campaign, ...bp.campaigns];
  const r = await saveBlueprintAction({ ...bp, campaigns }, existing ? "تعديل حملة" : "حملة جديدة");
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/dashboard/marketing");
  return { ok: true, slug };
}

export async function deleteCampaignAction(slug: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const s = await storeFor("discounts");
  if (!s) return { ok: false, error: "غير مصرح" };
  const bp = await currentBlueprint(s.storeId);
  if (!bp) return { ok: false, error: "تعذر قراءة إعدادات المتجر" };
  if (!bp.campaigns.some((c) => c.slug === slug)) return { ok: true };
  const r = await saveBlueprintAction({ ...bp, campaigns: bp.campaigns.filter((c) => c.slug !== slug) }, "حذف حملة");
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/dashboard/marketing");
  return { ok: true };
}
