"use server";

// setup-import.ts — إجراءات أداة استيراد المنتجات (تُستعمل في الإعداد وفي «استيراد منتجات» باللوحة):
// فرز نص أو صور إلى مرشّحين، ثم الحفظ بعد مراجعة التاجر. لا يُحفظ شيء قبل «اعتماد المنتجات».
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getTenantDb } from "@/db/tenant";
import { categories, productVariants, products } from "@/db/schema";
import { storeFor } from "@/server/merchant-guard";
import { analyzeImages, analyzeText } from "@/server/import/analyze";
import { IMPORT_MAX_CANDIDATES, normalizeCandidate, type Candidate } from "@/lib/import-candidates";
import { planCommit } from "@/lib/import-commit";
import { getBlueprintOrNull, invalidateStoreCache } from "@/lib/tenant";
import { isHostedImage } from "@/lib/media-hosts";
import { allow } from "@/lib/ratelimit";

const SESSION_ERR = "انتهت جلستكم، سجّلوا الدخول من جديد";

export type AnalyzeActionResult = { ok: true; candidates: Candidate[]; usedAi: boolean; notice?: string } | { ok: false; error: string };

export async function importAnalyzeTextAction(raw: unknown): Promise<AnalyzeActionResult> {
  const s = await storeFor("products");
  if (!s) return { ok: false, error: SESSION_ERR };
  const p = z.object({ entries: z.array(z.string().max(1500)).min(1).max(30) }).safeParse(raw);
  if (!p.success) return { ok: false, error: "النص طويل أو فارغ" };
  if (!(await allow("quote", `imp:${s.storeId}`))) return { ok: false, error: "طلبات كثيرة في وقت قصير. انتظروا لحظات ثم تابعوا." };
  return analyzeText(s.storeId, p.data.entries);
}

export async function importAnalyzeImagesAction(raw: unknown): Promise<AnalyzeActionResult> {
  const s = await storeFor("products");
  if (!s) return { ok: false, error: SESSION_ERR };
  const p = z.object({ urls: z.array(z.string().url()).min(1).max(6), mode: z.enum(["per_image", "grouped"]) }).safeParse(raw);
  if (!p.success) return { ok: false, error: "الصور غير صالحة" };
  // لا نقرأ إلا صوراً على مساحة ملفات المتجر نفسه (لا روابط عشوائية من العميل).
  if (!p.data.urls.every((u) => isHostedImage(u))) return { ok: false, error: "ارفعوا الصور من هنا مباشرة" };
  if (!(await allow("quote", `imp:${s.storeId}`))) return { ok: false, error: "طلبات كثيرة في وقت قصير. انتظروا لحظات ثم تابعوا." };
  return analyzeImages(s.storeId, p.data.urls, p.data.mode);
}

const candidateInput = z.object({
  id: z.string().max(40),
  name: z.string().max(200),
  price: z.number().nullable(),
  compareAt: z.number().nullable(),
  description: z.string().max(2000),
  category: z.string().max(120),
  sizes: z.array(z.string().max(30)).max(30),
  colors: z.array(z.string().max(40)).max(20),
  images: z.array(z.string().max(1000)).max(12),
  stock: z.number().int().nullable(),
  source: z.enum(["text", "image", "file", "manual"]),
});

export type CommitResult =
  | { ok: true; active: number; drafts: number; newCategories: number; variantCount: number; rehost: { id: string; name: string }[] }
  | { ok: false; error: string };

export async function importCommitAction(raw: unknown): Promise<CommitResult> {
  const s = await storeFor("products");
  if (!s) return { ok: false, error: SESSION_ERR };
  const parsed = z.object({ candidates: z.array(candidateInput).min(1).max(IMPORT_MAX_CANDIDATES) }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: `يمكن اعتماد حتى ${IMPORT_MAX_CANDIDATES} منتج في المرة الواحدة` };
  // إعادة التنقية على الخادم: ما يصل من المتصفح لا يُحفظ كما هو.
  const cands = parsed.data.candidates.map((c) => normalizeCandidate(c)).filter((c): c is Candidate => Boolean(c));
  if (!cands.length) return { ok: false, error: "لا يوجد منتج بمواصفات صالحة" };

  const db = await getTenantDb(s.storeId);
  const tracking = (await getBlueprintOrNull(s.storeId))?.inventory.tracking ?? true;
  const [existingProducts, existingCats] = await Promise.all([
    db.select({ slug: products.slug, sortOrder: products.sortOrder }).from(products).where(eq(products.storeId, s.storeId)),
    db.select({ id: categories.id, name: categories.name, slug: categories.slug }).from(categories).where(eq(categories.storeId, s.storeId)),
  ]);
  const plan = planCommit({
    storeId: s.storeId,
    candidates: cands,
    existingCategories: existingCats,
    existingSlugs: existingProducts.map((x) => x.slug),
    tracking,
    newId: () => crypto.randomUUID(),
    sortOffset: { categories: existingCats.length, products: existingProducts.reduce((m, p) => Math.max(m, p.sortOrder), 0) + 1 },
  });

  // الأقسام والمنتجات والتركيبات كلها في معاملة واحدة: إما يُعتمد الكل أو لا شيء.
  const chunks = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
  try {
    await db.batch([
      ...(plan.categories.length ? [db.insert(categories).values(plan.categories)] : []),
      ...chunks(plan.products, 80).map((c) => db.insert(products).values(c)),
      ...chunks(plan.variants, 200).map((c) => db.insert(productVariants).values(c)),
    ] as never);
  } catch (e) {
    console.error("[importCommitAction]", e);
    return { ok: false, error: "تعذر حفظ المنتجات. لم يُحفظ شيء، حاولوا مرة أخرى." };
  }
  await invalidateStoreCache(s.store);
  revalidatePath("/dashboard/products");
  return {
    ok: true,
    ...plan.stats,
    rehost: plan.products.filter((p) => p.images.some((i) => !isHostedImage(i.url))).map((p) => ({ id: p.id, name: p.name })),
  };
}
