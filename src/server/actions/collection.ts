"use server";
// collection.ts — «تحميل المزيد» في صفحات المنتجات: يعيد الدفعة التالية بالفلاتر نفسها (الرابط مصدر الحقيقة).
import { z } from "zod";
import { getStoreBySubdomain, isStorePubliclyVisible } from "@/lib/tenant";
import { getCategoryBySlug } from "@/server/repos/catalog";
import { queryCollection } from "@/server/repos/collection";
import { PAGE_SIZE, parseFilters } from "@/lib/collection-filters";

const schema = z.object({
  subdomain: z.string().min(1).max(63),
  /** slug القسم، أو فارغ لصفحة كل المنتجات. */
  category: z.string().max(120).optional(),
  query: z.string().max(600),
  offset: z.number().int().min(0).max(5000),
});

export async function loadMoreCollectionAction(raw: z.input<typeof schema>) {
  const p = schema.safeParse(raw);
  if (!p.success) return { rows: [], total: 0 };
  const store = await getStoreBySubdomain(p.data.subdomain);
  if (!store || !isStorePubliclyVisible(store)) return { rows: [], total: 0 };
  let scope: Parameters<typeof queryCollection>[1] = { type: "all" };
  if (p.data.category) {
    const cat = await getCategoryBySlug(store.id, p.data.category);
    if (!cat || !cat.isVisible) return { rows: [], total: 0 };
    scope = { type: "category", id: cat.id };
  }
  const f = parseFilters(Object.fromEntries(new URLSearchParams(p.data.query)));
  return queryCollection(store.id, scope, f, { offset: p.data.offset, limit: PAGE_SIZE });
}
