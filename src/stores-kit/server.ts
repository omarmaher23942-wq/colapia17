// server.ts — يبني StoreKit لطلب واحد، بمعرّف المتجر الذي حدده الخادم من النطاق. النواة فقط تستورده
// (ممنوع على stores/**): هنا يُربط كل وصول للبيانات بمتجر واحد قبل أن يصل لأي كود متجر خاص.
import "server-only";
import type { StoreBlueprint } from "@/blueprint/schema";
import type { StoreFact } from "@/blueprint/facts";
import { fetchApprovedReviews, fetchCategoriesForSection, fetchProductsForSource } from "@/blueprint/section-data";
import { renderCoreSection, renderStoreBlock } from "@/blueprint/registry";
import { getProductBySlug } from "@/server/repos/catalog";
import type { KitProduct, StoreKit } from "./types";

export function createStoreKit(input: { store: { id: string; name: string; subdomain: string }; bp: StoreBlueprint; facts: StoreFact[] }): StoreKit {
  const { bp, facts } = input;
  const storeId = input.store.id;
  const kit: StoreKit = {
    store: { id: storeId, name: input.store.name, subdomain: input.store.subdomain },
    bp,
    facts,
    data: {
      products: async (q = {}) => (await fetchProductsForSource(storeId, q.source, q.limit ?? 8)) as KitProduct[],
      product: async (slug) => ((await getProductBySlug(storeId, slug)) as KitProduct | null) ?? null,
      categories: async (slugs) =>
        (await fetchCategoriesForSection(storeId, slugs)).map((c) => ({ id: c.id, name: c.name, slug: c.slug, productCount: c.productCount, image: c.firstProductImage })),
      reviews: (limit = 6) => fetchApprovedReviews(storeId, limit),
    },
    // أقسام النواة فقط (بلا استبدال المتجر) حتى لا يستدعي مكوّن خاص نفسه بلا نهاية.
    section: (s) => {
      const ctx = { storeId, channels: bp.channels, facts, copy: bp.copy, kit };
      return s.type === "store_block" ? renderStoreBlock(s, ctx) : renderCoreSection(s, ctx);
    },
  };
  return kit;
}
