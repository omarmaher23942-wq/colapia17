"use server";

// studio.ts — استوديو المحتوى: يكتب تعليقات وستوري ونصوصاً إعلانية وتقويماً أسبوعياً من منتجات المتجر وحقائقه الفعلية فقط.
// كل عملية تُحسب على الحد الشهري (server/usage.ts)، وكل ناتج يمر بفلتر الصدق (lib/studio.ts) قبل العرض.
// تحسين الوصف يعرض المقترح فقط، ولا يُكتب في المنتج إلا بعد تأكيد التاجر (applyDescriptionAction).
import { revalidatePath } from "next/cache";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getTenantDb } from "@/db/tenant";
import { categories, products } from "@/db/schema";
import { storeFor } from "@/server/merchant-guard";
import { aiObject } from "@/ai/providers";
import { checkAiQuota, recordAi } from "@/server/usage";
import { getBlueprint, invalidateStoreCache } from "@/lib/tenant";
import { getStoreFacts } from "@/server/repos/facts";
import { publicStoreUrl } from "@/lib/utils";
import { SCHEMAS, STUDIO_KINDS, SYSTEM, allowedNumbers, buildPrompt, descriptionPrompt, descriptionSchema, filterHonest, type StudioFacts, type StudioKind, type StudioProduct } from "@/lib/studio";

const NO_SESSION = { ok: false as const, error: "انتهت جلستكم، سجّلوا الدخول من جديد" };

async function gather(s: NonNullable<Awaited<ReturnType<typeof storeFor>>>, ids: string[]): Promise<{ facts: StudioFacts; chosen: StudioProduct[] }> {
  const db = await getTenantDb(s.storeId);
  const rows = await db
    .select({ id: products.id, name: products.name, price: products.pricePiasters, compareAt: products.compareAtPiasters, short: products.shortDescription, tags: products.tags, category: categories.name })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(eq(products.storeId, s.storeId), eq(products.status, "active"), isNull(products.deletedAt)))
    .orderBy(desc(products.orderCount), desc(products.updatedAt))
    .limit(40);
  const all: StudioProduct[] = rows.map((r) => ({ id: r.id, name: r.name, priceEgp: Math.round(r.price / 100), compareAtEgp: r.compareAt ? Math.round(r.compareAt / 100) : null, shortDescription: r.short, category: r.category ?? null, tags: r.tags ?? [] }));
  const bp = await getBlueprint(s.storeId);
  const facts = (await getStoreFacts(s.storeId, bp)).map((f) => f.detail);
  return {
    facts: { storeName: s.store.name, niche: bp.brand.tagline ?? null, facts, products: all, url: publicStoreUrl(s.store) },
    chosen: all.filter((p) => ids.includes(p.id)),
  };
}

export type StudioResult = { ok: true; kind: StudioKind; items: unknown[]; dropped: number } | { ok: false; error: string };

const genInput = z.object({ kind: z.enum(STUDIO_KINDS), productIds: z.array(z.string().uuid()).max(6).default([]) });

export async function generateContentAction(raw: unknown): Promise<StudioResult> {
  const s = await storeFor("content");
  if (!s) return NO_SESSION;
  const p = genInput.safeParse(raw);
  if (!p.success) return { ok: false, error: "بيانات غير صالحة" };
  const { kind, productIds } = p.data;
  if (kind !== "calendar" && !productIds.length) return { ok: false, error: "اختاروا منتجاً واحداً على الأقل" };
  if (kind === "product_post" && productIds.length !== 1) return { ok: false, error: "اختاروا منتجاً واحداً لمنشور المنتج" };

  const q = await checkAiQuota(s.storeId, "content");
  if (!q.ok) return { ok: false, error: q.message };
  const { facts, chosen } = await gather(s, productIds);
  if (!facts.products.length) return { ok: false, error: "أضيفوا منتجات منشورة أولاً ليكتب الاستوديو منها." };

  let out: Record<string, unknown>;
  try {
    out = (await aiObject(
      "fast",
      { schema: SCHEMAS[kind], schemaName: `studio_${kind}`, system: SYSTEM, prompt: buildPrompt(kind, facts, chosen), temperature: 0.7, maxTokens: 1400, budgetMs: 28_000, timeoutMs: 18_000 },
      { purpose: `studio_${kind}`, storeId: s.storeId }
    )) as Record<string, unknown>;
  } catch (e) {
    console.error("[studio]", e);
    return { ok: false, error: "تعذّر إنشاء المحتوى الآن. حاولوا بعد لحظات." };
  }
  await recordAi(s.storeId, "content");
  const list = (kind === "calendar" ? out.days : out.items) as unknown[];
  const allowed = allowedNumbers(facts);
  const items = filterHonest(list, allowed);
  if (!items.length) return { ok: false, error: "لم تُقبل النتائج لأنها ذكرت معلومات غير موجودة في بياناتكم. أعيدوا المحاولة." };
  return { ok: true, kind, items, dropped: list.length - items.length };
}

export type DescriptionSuggestion = { ok: true; productId: string; current: string | null; description: string; shortDescription: string } | { ok: false; error: string };

export async function suggestDescriptionAction(productId: string): Promise<DescriptionSuggestion> {
  const s = await storeFor("products");
  if (!s) return NO_SESSION;
  if (!z.string().uuid().safeParse(productId).success) return { ok: false, error: "منتج غير صالح" };
  const q = await checkAiQuota(s.storeId, "describe");
  if (!q.ok) return { ok: false, error: q.message };
  const db = await getTenantDb(s.storeId);
  const [row] = await db
    .select({ id: products.id, name: products.name, price: products.pricePiasters, compareAt: products.compareAtPiasters, description: products.description, short: products.shortDescription })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.storeId, s.storeId), isNull(products.deletedAt)))
    .limit(1);
  if (!row) return { ok: false, error: "المنتج غير موجود" };
  const bp = await getBlueprint(s.storeId);
  const facts: StudioFacts = { storeName: s.store.name, niche: bp.brand.tagline ?? null, facts: [], products: [], url: publicStoreUrl(s.store) };
  try {
    const r = await aiObject(
      "fast",
      {
        schema: descriptionSchema,
        schemaName: "studio_description",
        system: SYSTEM,
        prompt: descriptionPrompt(facts, { id: row.id, name: row.name, priceEgp: Math.round(row.price / 100), compareAtEgp: null, shortDescription: row.short, category: null, tags: [], description: row.description }),
        temperature: 0.4,
        maxTokens: 700,
        budgetMs: 24_000,
        timeoutMs: 16_000,
      },
      { purpose: "studio_description", storeId: s.storeId }
    );
    await recordAi(s.storeId, "describe");
    const allowed = allowedNumbers({ ...facts, products: [{ id: row.id, name: row.name, priceEgp: Math.round(row.price / 100), compareAtEgp: null, shortDescription: row.short, category: null, tags: [] }] });
    const extra = new Set([...allowed, ...(`${row.description ?? ""} ${row.short ?? ""}`.match(/\d+/g) ?? [])]);
    if (filterHonest([r], extra).length === 0) return { ok: false, error: "الاقتراح ذكر معلومات غير موجودة في وصف المنتج، فلم نعرضه. أعيدوا المحاولة." };
    return { ok: true, productId: row.id, current: row.description, description: r.description, shortDescription: r.shortDescription };
  } catch (e) {
    console.error("[studio:description]", e);
    return { ok: false, error: "تعذّر اقتراح وصف الآن. حاولوا بعد لحظات." };
  }
}

export async function applyDescriptionAction(productId: string, description: string, shortDescription: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const s = await storeFor("products");
  if (!s) return NO_SESSION;
  const v = z.object({ id: z.string().uuid(), d: z.string().trim().min(2).max(2000), sd: z.string().trim().max(200) }).safeParse({ id: productId, d: description, sd: shortDescription });
  if (!v.success) return { ok: false, error: "بيانات غير صالحة" };
  const db = await getTenantDb(s.storeId);
  const rows = await db
    .update(products)
    .set({ description: v.data.d, shortDescription: v.data.sd || null, updatedAt: new Date() })
    .where(and(eq(products.id, v.data.id), eq(products.storeId, s.storeId)))
    .returning({ id: products.id });
  if (!rows.length) return { ok: false, error: "المنتج غير موجود" };
  await invalidateStoreCache(s.store);
  revalidatePath("/dashboard/studio");
  revalidatePath(`/dashboard/products/${v.data.id}`);
  return { ok: true };
}
