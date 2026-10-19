"use server";

// setup.ts — إجراءات «إعداد المتجر» (V2). كل خطوة تحفظ فوراً في بيانات المتجر الحقيقية بإجراءات اللوحة نفسها
// (الدفع والتواصل والشحن والسياسات والـ Blueprint)، والتقدم في stores.onboarding. لا جدول مسودات.
// التفعيل يفحص الجاهزية على الخادم ثم يبدأ التجربة: بيانات فارغة أو غير مكتملة لا تُفعَّل مهما فعلت الواجهة.
import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { getTenantDb } from "@/db/tenant";
import { categories, products, shippingZones, stores } from "@/db/schema";
import { ownerStore, storeFor } from "@/server/merchant-guard";
import { blueprintSchema, type StoreBlueprint } from "@/blueprint/schema";
import { INSPECTION_COD_NOTE } from "@/blueprint/defaults";
import { invalidateStoreCache } from "@/lib/tenant";
import { publicStoreUrl } from "@/lib/utils";
import { draftFrom } from "@/lib/store-settings";
import {
  brandPalette,
  etaText,
  FONT_PAIRS,
  mergeProgress,
  normalizeHex,
  returnsFromTemplate,
  STEP_IDS,
  zonesFromPlan,
  type ReadinessItem,
  type ReturnsTemplate,
  type ShippingPlan,
  type StepId,
} from "@/lib/onboarding";
import { applyHeroMedia, type HeroMediaChoice } from "@/lib/design-tweak";
import { applyTheme, isThemeId } from "@/blueprint/themes";
import { isNiche } from "@/lib/niche-attributes";
import { startTrial } from "@/ai/lifecycle/deliver";
import { saveBlueprintAction } from "./blueprint";
import { saveShippingSettingsAction } from "./shipping";
import { saveStoreSettingsAction } from "./store-settings";
import { tweakDesign, undoToVersion, type TweakOutcome } from "@/server/design-tweak";
import { loadBlueprint, readinessFor } from "@/server/setup-data";

type Fail = { ok: false; error: string; field?: string };
type Ok<T = object> = { ok: true } & T;

const SESSION_ERR = "انتهت جلستكم، سجّلوا الدخول من جديد";

const loadBp = loadBlueprint;

/** stores.onboarding الحالية من القاعدة (الوكيل قد يكتب صور المحادثة فيها بالتوازي، فلا نبني على نسخة الجلسة). */
async function freshOnboarding(storeId: string): Promise<Record<string, unknown>> {
  const [row] = await db.select({ o: stores.onboarding }).from(stores).where(eq(stores.id, storeId)).limit(1);
  return row?.o ?? {};
}

// ─── التقدم ──────────────────────────────────────────────────────────────────

const progressInput = z.object({
  step: z.enum(STEP_IDS),
  markDone: z.enum(STEP_IDS).optional(),
  unmark: z.enum(STEP_IDS).optional(),
});

export async function saveProgressAction(raw: unknown): Promise<Ok | Fail> {
  const s = await ownerStore();
  if (!s) return { ok: false, error: SESSION_ERR };
  const p = progressInput.safeParse(raw);
  if (!p.success) return { ok: false, error: "خطوة غير صالحة" };
  // الإعداد المنتهي لا يتقدم: الحالة وحدها تحدد (لا تعديل على متجر بدأت تجربته).
  const next = mergeProgress(await freshOnboarding(s.storeId), p.data);
  await db.update(stores).set({ onboarding: next, setupStartedAt: s.store.setupStartedAt ?? new Date(), updatedAt: new Date() }).where(eq(stores.id, s.storeId));
  return { ok: true };
}

// ─── 1) الهوية ───────────────────────────────────────────────────────────────

const identityInput = z.object({
  name: z.string().trim().min(1, "اكتبوا اسم المتجر").max(60, "اسم المتجر 60 حرفاً على الأكثر"),
  primary: z.string(),
  fontPair: z.enum(FONT_PAIRS.map((f) => f.id) as [string, ...string[]]),
  logoUrl: z.string().url().refine((u) => u.startsWith("https://"), "رابط الشعار غير آمن").nullable(),
});

export async function saveIdentityAction(raw: unknown): Promise<Ok | Fail> {
  const s = await storeFor("content");
  if (!s) return { ok: false, error: SESSION_ERR };
  const p = identityInput.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "بيانات غير صالحة", field: p.error.issues[0]?.path[0]?.toString() };
  const color = normalizeHex(p.data.primary);
  if (!color) return { ok: false, error: "اللون غير صالح", field: "primary" };
  const bp = await loadBp(s.storeId);
  if (!bp) return { ok: false, error: "تعذر قراءة إعدادات المتجر" };
  const pair = FONT_PAIRS.find((f) => f.id === p.data.fontPair)!;
  const next: StoreBlueprint = {
    ...bp,
    brand: { ...withLogo(bp.brand, p.data.logoUrl, p.data.name), name: p.data.name },
    theme: { ...bp.theme, palette: brandPalette(color, bp.theme.mode === "dark"), fonts: { ...bp.theme.fonts, heading: pair.heading, body: pair.body } },
  };
  const r = await saveBlueprintAction(next, "هوية المتجر");
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

/** الشعار في كل مكان: الهيدر والفوتر والفاتورة وأيقونة التبويب (favicon) وصورة المشاركة تقرأ brand.logo،
 * والأيقونة تتبعه في brand.favicon ما دام التاجر لم يضع أيقونة مختلفة يدوياً. */
function withLogo(brand: StoreBlueprint["brand"], url: string | null, name: string): StoreBlueprint["brand"] {
  const followsLogo = !brand.favicon || brand.favicon === brand.logo?.url;
  if (!url) return { ...brand, logo: undefined, favicon: followsLogo ? undefined : brand.favicon };
  return { ...brand, logo: { url, alt: name, focalX: 0.5, focalY: 0.5 }, favicon: followsLogo ? url : brand.favicon };
}

const logoInput = z.object({ url: z.string().url().refine((u) => u.startsWith("https://"), "رابط الشعار غير آمن").nullable() });

/** يحفظ الشعار فور رفعه (لا ينتظر «حفظ ومتابعة») فيظهر في المعاينة وأيقونة التبويب مباشرة. */
export async function saveLogoAction(raw: unknown): Promise<Ok | Fail> {
  const s = await storeFor("content");
  if (!s) return { ok: false, error: SESSION_ERR };
  const p = logoInput.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "رابط غير صالح" };
  const bp = await loadBp(s.storeId);
  if (!bp) return { ok: false, error: "تعذر قراءة إعدادات المتجر" };
  const r = await saveBlueprintAction({ ...bp, brand: withLogo(bp.brand, p.data.url, bp.brand.name) }, p.data.url ? "شعار المتجر" : "إزالة الشعار");
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

/** يطبّق أحد التصميمات الكاملة (ألوان وخطوط وبطاقات وأزرار) مع إبقاء المحتوى، ويحفظ الاختيار لإعادة عرضه. */
export async function saveThemeAction(raw: unknown): Promise<Ok | Fail> {
  const s = await storeFor("content");
  if (!s) return { ok: false, error: SESSION_ERR };
  const theme = (raw as { theme?: unknown } | null)?.theme;
  if (!isThemeId(theme)) return { ok: false, error: "تصميم غير صالح" };
  const bp = await loadBp(s.storeId);
  if (!bp) return { ok: false, error: "تعذر قراءة إعدادات المتجر" };
  const r = await saveBlueprintAction(applyTheme(bp, theme), "تصميم المتجر");
  if (!r.ok) return { ok: false, error: r.error };
  await db.update(stores).set({ onboarding: { ...(await freshOnboarding(s.storeId)), themeId: theme }, updatedAt: new Date() }).where(eq(stores.id, s.storeId));
  revalidatePath("/dashboard/design");
  return { ok: true };
}

/** نوع النشاط الذي يختاره التاجر (يحدد حقول المنتج): يُحفظ في stores.onboarding.nicheKind دون مسح غيره. */
export async function saveNicheAction(raw: unknown): Promise<Ok | Fail> {
  const s = await storeFor("products");
  if (!s) return { ok: false, error: SESSION_ERR };
  const niche = (raw as { niche?: unknown } | null)?.niche;
  if (!isNiche(niche)) return { ok: false, error: "نوع نشاط غير صالح" };
  await db.update(stores).set({ onboarding: { ...(await freshOnboarding(s.storeId)), nicheKind: niche }, updatedAt: new Date() }).where(eq(stores.id, s.storeId));
  return { ok: true };
}

// ─── 3) الدفع ────────────────────────────────────────────────────────────────

const paymentInput = z.object({
  cod: z.boolean(),
  inspection: z.boolean(),
  codFee: z.coerce.number().min(0, "الرسوم لا تقل عن صفر").max(500, "الرسوم 500 جنيه على الأكثر"),
  vodafone: z.object({ enabled: z.boolean(), number: z.string().max(40), holder: z.string().max(80) }),
  instapay: z.object({ enabled: z.boolean(), target: z.string().max(120), holder: z.string().max(80) }),
});

export async function savePaymentStepAction(raw: unknown): Promise<Ok | (Fail & { errors?: Record<string, string> })> {
  const s = await storeFor("settings");
  if (!s) return { ok: false, error: SESSION_ERR };
  const p = paymentInput.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "بيانات غير صالحة" };
  const d = p.data;
  const bp = await loadBp(s.storeId);
  if (!bp) return { ok: false, error: "تعذر قراءة إعدادات المتجر" };

  const draft = draftFrom(bp, { acceptingOrders: s.store.acceptingOrders, vacationMessage: s.store.vacationMessage });
  const r = await saveStoreSettingsAction({
    ...draft,
    cod: d.cod,
    vodafone: { enabled: d.vodafone.enabled, number: d.vodafone.number, holder: d.vodafone.holder },
    instapay: { enabled: d.instapay.enabled, target: d.instapay.target, holder: d.instapay.holder },
  });
  if (!r.ok) return { ok: false, error: r.error, errors: r.errors as Record<string, string> | undefined };

  // المعاينة قبل الدفع ورسوم الاستلام: تُحفظ في الـ Blueprint وجدول الشحن (إن وُجد) وعلى التقدم ليراها خطوة الشحن.
  const fresh = await loadBp(s.storeId);
  if (fresh) {
    const note = d.cod && d.inspection ? INSPECTION_COD_NOTE : undefined;
    if (fresh.shipping.inspectionAllowed !== d.inspection || fresh.payments.cod.note !== note) {
      const sv = await saveBlueprintAction(
        { ...fresh, shipping: { ...fresh.shipping, inspectionAllowed: d.inspection }, payments: { ...fresh.payments, cod: { ...fresh.payments.cod, note } } },
        "طرق الدفع"
      );
      if (!sv.ok) return { ok: false, error: sv.error };
    }
  }
  const fee = d.cod ? Math.round(d.codFee * 100) : 0;
  const tdb = await getTenantDb(s.storeId);
  await tdb.update(shippingZones).set({ codExtraPiasters: fee }).where(eq(shippingZones.storeId, s.storeId));
  await db.update(stores).set({ onboarding: { ...(await freshOnboarding(s.storeId)), codFee: fee }, updatedAt: new Date() }).where(eq(stores.id, s.storeId));
  await invalidateStoreCache(s.store);
  return { ok: true };
}

// ─── 4) الشحن ────────────────────────────────────────────────────────────────

const money = z.coerce.number().min(0).max(5000);
const planInput: z.ZodType<ShippingPlan> = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("flat"), fee: money }),
  z.object({ kind: z.literal("cairo_giza"), cairoFee: money, restFee: money }),
  z.object({
    kind: z.literal("custom"),
    groups: z.object({ gc: money.nullable(), alex: money.nullable(), delta: money.nullable(), canal: money.nullable(), upper: money.nullable(), remote: money.nullable() }),
  }),
]);
const shippingInput = z
  .object({
    plan: planInput,
    etaMin: z.coerce.number().int().min(0).max(30),
    etaMax: z.coerce.number().int().min(0).max(30),
    freeOver: z.coerce.number().min(1, "حد الشحن المجاني أكبر من صفر").max(1_000_000).nullable(),
  })
  .refine((v) => v.etaMax >= v.etaMin, { message: "أقصى مدة توصيل أقل من أدناها", path: ["etaMax"] });

export async function saveShippingStepAction(raw: unknown): Promise<Ok | Fail> {
  const s = await storeFor("shipping");
  if (!s) return { ok: false, error: SESSION_ERR };
  const p = shippingInput.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "بيانات غير صالحة", field: p.error.issues[0]?.path.join(".") };
  const { plan, etaMin, etaMax, freeOver } = p.data;
  if (plan.kind === "custom" && !Object.values(plan.groups).some((v) => v !== null)) return { ok: false, error: "حدّدوا سعراً لمجموعة محافظات واحدة على الأقل" };
  const codFee = Number((await freshOnboarding(s.storeId)).codFee ?? 0) / 100;
  const zones = zonesFromPlan(plan, { min: etaMin, max: etaMax }, codFee);
  const r = await saveShippingSettingsAction({
    zones,
    mode: plan.kind === "flat" ? "flat" : "zones",
    flatRate: plan.kind === "flat" ? plan.fee : null,
    freeOver,
    generalEta: etaText(etaMin, etaMax),
  });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

// ─── 5) الاستبدال والاسترجاع ─────────────────────────────────────────────────

const paidBy = z.enum(["customer", "store", "store_if_defect"]);
const returnsInput: z.ZodType<ReturnsTemplate> = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  z.object({ kind: z.literal("exchange"), days: z.coerce.number().int().min(1).max(60), paidBy }),
  z.object({ kind: z.literal("exchange_refund"), days: z.coerce.number().int().min(1).max(60), paidBy }),
]);

export async function saveReturnsStepAction(raw: unknown): Promise<Ok | Fail> {
  const s = await storeFor("settings");
  if (!s) return { ok: false, error: SESSION_ERR };
  const p = returnsInput.safeParse(raw);
  if (!p.success) return { ok: false, error: "اختيار غير صالح" };
  const bp = await loadBp(s.storeId);
  if (!bp) return { ok: false, error: "تعذر قراءة إعدادات المتجر" };
  const r = await saveBlueprintAction({ ...bp, returns: returnsFromTemplate(p.data, bp.returns) }, "الاستبدال والاسترجاع");
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

// ─── 6) التواصل ──────────────────────────────────────────────────────────────

const contactInput = z.object({ whatsapp: z.string().max(40), instagram: z.string().max(200), facebook: z.string().max(300), tiktok: z.string().max(200) });

export async function saveContactStepAction(raw: unknown): Promise<Ok | (Fail & { errors?: Record<string, string> })> {
  const s = await storeFor("settings");
  if (!s) return { ok: false, error: SESSION_ERR };
  const p = contactInput.safeParse(raw);
  if (!p.success) return { ok: false, error: "بيانات غير صالحة" };
  if (!p.data.whatsapp.trim()) return { ok: false, error: "أضيفوا رقم واتساب المتجر", errors: { whatsapp: "أضيفوا رقم واتساب المتجر" } };
  const bp = await loadBp(s.storeId);
  if (!bp) return { ok: false, error: "تعذر قراءة إعدادات المتجر" };
  const draft = draftFrom(bp, { acceptingOrders: s.store.acceptingOrders, vacationMessage: s.store.vacationMessage });
  const r = await saveStoreSettingsAction({ ...draft, ...p.data });
  return r.ok ? { ok: true } : { ok: false, error: r.error, errors: r.errors as Record<string, string> | undefined };
}

// ─── 8) لمسات الشكل ──────────────────────────────────────────────────────────

const heroInput: z.ZodType<HeroMediaChoice> = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("auto") }),
  z.object({ kind: z.literal("video_fashion") }),
  z.object({ kind: z.literal("video_electronics") }),
  z.object({ kind: z.literal("video_upload"), url: z.string().url(), poster: z.string().url().optional() }),
  z.object({ kind: z.literal("side_image"), url: z.string().url() }),
]);

export async function saveHeroMediaAction(raw: unknown): Promise<Ok<{ summary: string }> | Fail> {
  const s = await storeFor("content");
  if (!s) return { ok: false, error: SESSION_ERR };
  const p = heroInput.safeParse(raw);
  if (!p.success) return { ok: false, error: "اختيار غير صالح" };
  const bp = await loadBp(s.storeId);
  if (!bp) return { ok: false, error: "تعذر قراءة إعدادات المتجر" };
  const tdb = await getTenantDb(s.storeId);
  const rows = await tdb
    .select({ name: products.name, images: products.images })
    .from(products)
    .where(and(eq(products.storeId, s.storeId), eq(products.status, "active"), isNull(products.deletedAt), sql`jsonb_array_length(${products.images}) > 0`))
    .orderBy(products.sortOrder)
    .limit(4);
  // الفيديوهات الجاهزة تُحفظ بمسار نسبي (/demo/media/...): تُخدم من نطاق المتجر نفسه (ملفات ثابتة خارج الوسيط).
  // كان الرابط مطلقاً على أصل المنصة، فترفضه سياسة أمان المحتوى على نطاق المتجر (media-src) ولا يقبله مُحسّن الصور
  // (غير مدرج في المضيفات البعيدة)، فيظهر الغلاف صورة مكسورة والفيديو لا يعمل.
  const applied = applyHeroMedia(bp, p.data, "", rows.map((r) => ({ url: r.images[0]!.url, alt: r.name })));
  if ("error" in applied) return { ok: false, error: applied.error };
  const r = await saveBlueprintAction(applied.blueprint, "واجهة المتجر");
  return r.ok ? { ok: true, summary: applied.summary } : { ok: false, error: r.error };
}

export async function tweakDesignAction(raw: unknown): Promise<TweakOutcome> {
  const s = await storeFor("content");
  if (!s) return { ok: false, error: SESSION_ERR };
  const p = z.object({ text: z.string().max(400) }).safeParse(raw);
  if (!p.success) return { ok: false, error: "النص طويل" };
  const r = await tweakDesign(s.storeId, p.data.text);
  if (r.ok && r.applied) revalidatePath("/dashboard/design");
  return r;
}

export async function undoDesignAction(raw: unknown): Promise<Ok | Fail> {
  const s = await storeFor("content");
  if (!s) return { ok: false, error: SESSION_ERR };
  const p = z.object({ version: z.number().int().min(1) }).safeParse(raw);
  if (!p.success) return { ok: false, error: "نسخة غير صالحة" };
  const r = await undoToVersion(s.storeId, p.data.version);
  if (r.ok) revalidatePath("/dashboard/design");
  return r;
}

// ─── 9) الجاهزية والتفعيل ────────────────────────────────────────────────────

export async function readinessAction(): Promise<Ok<{ ready: boolean; items: ReadinessItem[]; inspection: boolean }> | Fail> {
  const s = await ownerStore();
  if (!s) return { ok: false, error: SESSION_ERR };
  const [r, bp] = await Promise.all([readinessFor(s.storeId), loadBp(s.storeId)]);
  return r ? { ok: true, ready: r.ok, items: r.items, inspection: Boolean(bp?.shipping.inspectionAllowed) } : { ok: false, error: "تعذر قراءة إعدادات المتجر" };
}

/** ترتيب لمسات أخيرة قبل أن يراه الزوار: عناوين البحث والأوصاف، ترتيب الأقسام، وصور الواجهة من المنتجات. */
async function tidyStore(storeId: string, bp: StoreBlueprint): Promise<void> {
  const tdb = await getTenantDb(storeId);
  const brand = bp.brand.name.slice(0, 40);
  await tdb.execute(sql`
    update products set
      seo_title = left(name || ' | ' || ${brand}, 70),
      seo_description = left(coalesce(nullif(short_description, ''), nullif(description, ''), name), 160)
    where store_id = ${storeId} and status = 'active' and deleted_at is null and (seo_title is null or seo_description is null)
  `);
  // الأقسام الأكثر منتجات أولاً.
  await tdb.execute(sql`
    update categories c set sort_order = r.rn
    from (
      select cat.id, row_number() over (order by count(p.id) desc, cat.created_at) - 1 as rn
      from categories cat
      left join products p on p.category_id = cat.id and p.status = 'active' and p.deleted_at is null
      where cat.store_id = ${storeId}
      group by cat.id
    ) r
    where c.id = r.id
  `);
  const hero = bp.home.find((x) => x.type === "hero");
  let next = bp;
  if (hero && hero.type === "hero" && !hero.videoUrl && hero.images.length === 0) {
    const rows = await tdb
      .select({ name: products.name, images: products.images })
      .from(products)
      .where(and(eq(products.storeId, storeId), eq(products.status, "active"), isNull(products.deletedAt), sql`jsonb_array_length(${products.images}) > 0`))
      .orderBy(products.sortOrder)
      .limit(4);
    const a = applyHeroMedia(bp, { kind: "auto" }, "", rows.map((r) => ({ url: r.images[0]!.url, alt: r.name })));
    if (!("error" in a)) next = a.blueprint;
  }
  const seo = { ...next.seo, title: next.seo.title ?? bp.brand.name.slice(0, 70) };
  if (!seo.description) {
    const cats = await tdb.select({ name: categories.name }).from(categories).where(and(eq(categories.storeId, storeId), eq(categories.isVisible, true))).orderBy(categories.sortOrder).limit(3);
    seo.description = `تسوّقوا من ${bp.brand.name}${cats.length ? `: ${cats.map((c) => c.name).join("، ")}` : ""}.`.slice(0, 160);
  }
  if (next !== bp || seo.title !== bp.seo.title || seo.description !== bp.seo.description) {
    await saveBlueprintAction({ ...next, seo }, "لمسات قبل التفعيل");
  }
}

export type PublishResult = Ok<{ url: string; host: string }> | (Fail & { blockers?: ReadinessItem[] });

export async function publishStoreAction(): Promise<PublishResult> {
  const s = await ownerStore();
  if (!s) return { ok: false, error: SESSION_ERR };
  const url = publicStoreUrl(s.store);
  const done = (): PublishResult => ({ ok: true, url, host: url.replace(/^https?:\/\//, "") });
  if (s.store.status === "trial" || s.store.status === "active") return done();
  if (s.store.status !== "setup") return { ok: false, error: "لا يمكن تفعيل المتجر في حالته الحالية" };

  const r = await readinessFor(s.storeId);
  if (!r) return { ok: false, error: "تعذر قراءة إعدادات المتجر" };
  if (!r.ok) return { ok: false, error: "أكملوا النقاط التالية ثم فعّلوا المتجر", blockers: r.blockers };

  const bp = await loadBp(s.storeId);
  if (bp) {
    try {
      await tidyStore(s.storeId, bp);
    } catch (e) {
      // اللمسات الأخيرة تحسين لا شرط: فشلها لا يمنع التفعيل.
      console.error("[publishStoreAction] tidy", e);
    }
  }
  const t = await startTrial(s.storeId, `merchant:${s.merchantId}`);
  if (!t.ok) {
    // سباق نقرتين: الثانية ترى المتجر وقد بدأ.
    const [fresh] = await db.select({ status: stores.status }).from(stores).where(eq(stores.id, s.storeId)).limit(1);
    if (fresh && fresh.status !== "setup") return done();
    return { ok: false, error: "تعذر تفعيل المتجر الآن، حاولوا مرة أخرى" };
  }
  const merged = mergeProgress(await freshOnboarding(s.storeId), { step: "publish", markDone: "publish" });
  await db.update(stores).set({ onboarding: merged }).where(eq(stores.id, s.storeId));
  await invalidateStoreCache(s.store);
  revalidatePath("/dashboard", "layout");
  return done();
}

export type { StepId };
