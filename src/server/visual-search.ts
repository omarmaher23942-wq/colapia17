import "server-only";
// visual-search.ts — «البحث بالصورة» في المتجر (PLAN 14-ب.5): الزائر يرفع سكرين شوت ← قراءة الصورة (النوع والألوان
// والنص الظاهر) ← أقرب منتجات من كتالوج المتجر نفسه ← مقارنة بصرية للمرشحين ← القطعة نفسها بثقة، أو «قريبة منها».
// الصورة لا تُخزَّن. حد شهري لكل متجر (إعداد visual_search)، وما لم يُعثر عليه يُسجَّل للتاجر (بلا صورة).
import { and, desc, eq, isNull } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { categories, products } from "@/db/schema";
import { aiObject } from "@/ai/providers";
import { getFlag } from "@/lib/flags";
import { redis } from "@/lib/redis";
import { visualSearchLimit } from "@/server/usage";
import { cairoDate } from "@/lib/cairo-time";
import { logVisualMiss } from "@/server/visual-search-misses";
import { decide, pickCandidates, readSchema, verdictSchema, type CatalogItem, type VisionRead } from "@/lib/visual-search";

export const VISUAL_SEARCH_FLAG = "visual_search";
export const DEFAULT_MONTHLY = 400;

export type VisualResult = {
  status: "match" | "similar" | "none" | "not_product" | "limit";
  match: ResultItem | null;
  similar: ResultItem[];
  seen: string | null;
};
export type ResultItem = { id: string; slug: string; name: string; image: string; pricePiasters: number; compareAtPiasters: number | null };

const monthKey = (storeId: string) => {
  const d = cairoDate(new Date());
  return `vs:count:${storeId}:${d.y}-${String(d.m).padStart(2, "0")}`;
};

/** الحد الشهري من باقة المتجر (V3: server/usage.ts)، والإعداد «visual_search» مفتاح إيقاف عام للمالك. */
async function monthlyLimit(storeId: string): Promise<number> {
  const f = await getFlag<{ perMonth?: number }>(VISUAL_SEARCH_FLAG).catch(() => ({ enabled: true, config: null }));
  if (!f.enabled) return 0;
  return visualSearchLimit(storeId).catch(() => DEFAULT_MONTHLY);
}

/** هل بقي من حد الشهر؟ يحجز بحثاً واحداً (يُعاد إن فشل قبل أي استدعاء للنموذج). */
async function reserve(storeId: string): Promise<boolean> {
  const limit = await monthlyLimit(storeId);
  if (limit <= 0) return false;
  const key = monthKey(storeId);
  const n = await redis.incr(key).catch(() => 0);
  if (n === 1) await redis.expire(key, 40 * 86400).catch(() => {});
  return n === 0 || n <= limit;
}

async function catalog(storeId: string): Promise<(CatalogItem & { slug: string; pricePiasters: number; compareAtPiasters: number | null })[]> {
  const db = await getTenantDb(storeId);
  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      short: products.shortDescription,
      tags: products.tags,
      search: products.searchText,
      images: products.images,
      orderCount: products.orderCount,
      pricePiasters: products.pricePiasters,
      compareAtPiasters: products.compareAtPiasters,
      category: categories.name,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(eq(products.storeId, storeId), eq(products.status, "active"), isNull(products.deletedAt)))
    .orderBy(desc(products.orderCount))
    .limit(400);
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    text: [r.short, r.category, r.tags.join(" "), r.search].filter(Boolean).join(" "),
    // صورة عامة فقط (https): المقارنة البصرية تفتح الرابط، ورابط نسبي أو داخلي يُسقط الطلب.
    image: /^https:\/\//.test(r.images[0]?.url ?? "") ? r.images[0]!.url : null,
    orderCount: r.orderCount,
    pricePiasters: r.pricePiasters,
    compareAtPiasters: r.compareAtPiasters,
  }));
}

const READ_SYSTEM = `أنت تقرأ صورة أرسلها زائر لمتجر مصري (ملابس أو أي منتجات) (غالباً سكرين شوت من ريلز أو منشور). صف القطعة الأساسية فقط بإيجاز:
- isProduct: هل في الصورة منتج يمكن شراؤه (ملابس، شنطة، حذاء، إكسسوار…)؟
- garment: نوع القطعة بالعربية وبالإنجليزية (مثل "فستان dress").
- colors: ألوانها الأساسية.
- keywords: الخامة والقصة والتفاصيل المميزة (كم، ياقة، طبعة…).
- visibleText: أي نص ظاهر في الصورة قد يكون اسم القطعة أو كودها أو سعرها، وإلا null.
- description: جملة قصيرة بالعربية تصف القطعة.
لا تخمّن ما لا يظهر. أخرج JSON فقط.`;

const COMPARE_SYSTEM = `أمامك صورة الزائر أولاً، ثم صور منتجات من المتجر مرقمة 1..N بنفس الترتيب. هل صورة الزائر هي نفس منتج من المرقمة؟
- best: رقم المنتج المطابق (نفس القطعة: النوع والقصة والتفاصيل؛ اللون قد يختلف بالإضاءة)، أو null إن لم يكن أي منها نفسها.
- confidence: ثقتك في best من 0 إلى 1. كن صارماً: قطعة تشبهها فقط ليست هي.
- similar: أرقام منتجات قريبة في الشكل أو النوع (حتى 3).
أخرج JSON فقط.`;

const asItem = (i: CatalogItem & { slug: string; pricePiasters: number; compareAtPiasters: number | null }): ResultItem => ({
  id: i.id,
  slug: i.slug,
  name: i.name,
  image: i.image!,
  pricePiasters: i.pricePiasters,
  compareAtPiasters: i.compareAtPiasters,
});


export async function runVisualSearch(storeId: string, image: Uint8Array, mime: string): Promise<VisualResult> {
  const items = await catalog(storeId);
  const empty: VisualResult = { status: "none", match: null, similar: [], seen: null };
  if (!items.some((i) => i.image)) return empty;
  if (!(await reserve(storeId))) return { ...empty, status: "limit" };

  const read = await aiObject(
    "visionFast",
    {
      schema: readSchema,
      system: READ_SYSTEM,
      messages: [{ role: "user", content: [{ type: "text", text: "صف القطعة." }, { type: "image", image, mediaType: mime }] }],
      temperature: 0,
      maxTokens: 300,
      timeoutMs: 15_000,
    },
    { purpose: "visual_search_read", storeId }
  );
  if (!read.isProduct) return { ...empty, status: "not_product", seen: read.description };

  const candidates = pickCandidates(read as VisionRead, items, 4) as typeof items;
  if (!candidates.length) {
    await logVisualMiss(storeId, read.description ?? read.garment);
    return { ...empty, seen: read.description ?? read.garment };
  }
  // المقارنة البصرية تحسّن الدقة فقط: إن تعذرت نعرض أقرب المرشحين بالوصف بصدق («قريبة منها») بدل خطأ.
  const verdict = await aiObject(
    "visionFast",
    {
      schema: verdictSchema,
      system: COMPARE_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "صورة الزائر:" },
            { type: "image", image, mediaType: mime },
            ...candidates.flatMap((c, i) => [
              { type: "text" as const, text: `منتج ${i + 1}: ${c.name}` },
              { type: "image" as const, image: new URL(c.image!) },
            ]),
          ],
        },
      ],
      temperature: 0,
      maxTokens: 200,
      timeoutMs: 20_000,
    },
    { purpose: "visual_search_compare", storeId }
  ).catch((e) => {
    console.error("[visual-search] compare failed, using text ranking", storeId, String(e).slice(0, 300));
    return { best: null, confidence: 0, similar: candidates.slice(0, 3).map((_, i) => i + 1) };
  });
  const d = decide(verdict, candidates);
  const result: VisualResult = {
    status: d.match ? "match" : d.similar.length ? "similar" : "none",
    match: d.match ? asItem(d.match as (typeof items)[number]) : null,
    similar: d.similar.map((x) => asItem(x as (typeof items)[number])),
    seen: read.description ?? read.garment,
  };
  if (!d.match) await logVisualMiss(storeId, result.seen);
  return result;
}
