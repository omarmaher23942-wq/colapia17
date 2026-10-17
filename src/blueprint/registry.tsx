import * as B from "@/components/blocks";
import type { Section, StoreBlueprint } from "./schema";
import { groundedItems, type StoreFact } from "./facts";
import { fetchActiveCouponCodes, fetchCategoriesForSection, fetchProductsForSource, type ProductSource } from "./section-data";
import { loadBlock, loadSectionOverride } from "@/stores/resolve";
import { viewAllHref } from "@/lib/links";
import { coreHeroVariant } from "./core-migrate";
import type { StoreKit } from "@/stores-kit/types";

export * from "./registry-meta";

const Block = B as any;

export type SectionCtx = {
  storeId: string;
  channels: StoreBlueprint["channels"];
  facts: StoreFact[];
  copy: StoreBlueprint["copy"];
  /** واجهة كود المتجر الخاص (stores/<slug>/). بدونها تُعرض النواة وحدها ولا تظهر المكوّنات الخاصة. */
  kit?: StoreKit;
};

// ─── Main async dispatcher ─────────────────────────────────────────────────
/**
 * يعرض قسماً: مكوّن المتجر الخاص إن كتبه فريق البناء (stores/<slug>/sections/<type>.tsx، ويستلم ما كانت النواة
 * ستعرضه في `core`)، وإلا قسم النواة. المكوّن الجديد كلياً (store_block) من stores/<slug>/blocks/<name>.tsx.
 */
export async function renderSection(s: Section, ctx: SectionCtx): Promise<React.ReactNode> {
  if (!s.enabled) return null;
  if (s.type === "store_block") return renderStoreBlock(s, ctx);
  const [core, Override] = await Promise.all([
    renderCoreSection(s, ctx),
    ctx.kit ? loadSectionOverride(ctx.kit.store.subdomain, s.type) : null,
  ]);
  if (!Override || !ctx.kit) return core;
  return <Override key={s.id} s={s} kit={ctx.kit} core={core} />;
}

export async function renderStoreBlock(s: Extract<Section, { type: "store_block" }>, ctx: SectionCtx): Promise<React.ReactNode> {
  if (!s.enabled || !ctx.kit) return null;
  const Comp = await loadBlock(ctx.kit.store.subdomain, s.name);
  // اسم بلا ملف (حُذف المكوّن أو نُقل القسم لمتجر آخر): لا شيء بدل خطأ يُسقط الصفحة.
  if (!Comp) return null;
  return <Comp key={s.id} s={s} props={s.props} kit={ctx.kit} />;
}

/** قسم النواة وحده، بلا أي استبدال من المتجر. */
export async function renderCoreSection(
  s: Section,
  ctx: SectionCtx
): Promise<React.ReactNode> {
  if (!s.enabled) return null;

  switch (s.type) {
    case "hero": {
      let spotlight = null;
      // واجهة بلا صور تستعير صورة أفضل منتج (النجم المختار وإلا الأحدث ظهوراً) بدل واجهة نصية فارغة.
      const wantsSpotlight = coreHeroVariant(s) === "product_spotlight";
      if (wantsSpotlight) {
        const source = s.spotlightProductSlug ? { type: "manual" as const, slugs: [s.spotlightProductSlug] } : { type: "featured" as const };
        const [p] = (await fetchProductsForSource(ctx.storeId, source, 1)).concat(s.spotlightProductSlug ? [] : await fetchProductsForSource(ctx.storeId, { type: "newest" }, 1));
        if (p) spotlight = { slug: p.slug, name: p.name, pricePiasters: p.pricePiasters, compareAtPiasters: p.compareAtPiasters, image: (p.images as { url: string }[])?.[0]?.url };
      }
      return <Block.Hero key={s.id} s={s} spotlight={spotlight} />;
    }

    case "categories": {
      const cats = (await fetchCategoriesForSection(ctx.storeId, (s as { categorySlugs?: string[] }).categorySlugs)).filter((c) => c.productCount > 0);
      // قسم واحد لا يحتاج شاشة اختيار أقسام.
      if (cats.length < 2) return null;
      return <Block.Categories key={s.id} s={s} categories={cats} />;
    }

    case "product_grid": {
      const source = (s as { source?: ProductSource }).source;
      const limit = (s as { limit?: number }).limit ?? 8;
      // نجلب limit+1 لنعرف بصدق أن هناك المزيد قبل عرض «عرض الكل».
      let prods = await fetchProductsForSource(ctx.storeId, source, limit + 1);
      // مصدر فارغ (لا منتجات مميزة مثلاً): نعرض الأحدث بدل قسم فارغ.
      let effective = source;
      if (!prods.length && source?.type !== "manual") {
        effective = { type: "newest" };
        prods = await fetchProductsForSource(ctx.storeId, effective, limit + 1);
      }
      // «الأكثر مبيعاً» بلا مبيعات فعلية يُخفى بدل ترتيب عشوائي بعنوان كاذب.
      if (effective?.type === "best_sellers") prods = prods.filter((p) => (p.orderCount ?? 0) > 0);
      if (!prods.length) return null;
      const hasMore = prods.length > limit;
      return <Block.ProductGrid key={s.id} s={s} products={prods.slice(0, limit)} hasMore={hasMore} viewAll={viewAllHref(effective)} />;
    }

    case "promo_banner": {
      // لافتة بكود خصم تظهر فقط ما دام الكود موجوداً وفعالاً الآن؛ بلا كود تُعرض كما هي.
      const live = await fetchActiveCouponCodes(ctx.storeId);
      const items = s.items.filter((i) => !i.couponCode || live.has(i.couponCode.toUpperCase()));
      if (!items.length) return null;
      return <Block.PromoBanner key={s.id} s={{ ...s, items }} />;
    }

    case "countdown_offer":
      // عرض انتهى موعده (أو بلا موعد صالح) لا يُعرض: عدّاد أصفار إلحاح كاذب.
      if (!(Date.parse(s.endsAt) > Date.now())) return null;
      return <Block.CountdownOffer key={s.id} s={s} />;

    case "trust_badges": {
      // الشارة المرتبطة بحقيقة تُعرض بصياغة الحقيقة نفسها (مصدر واحد)، وما لا تسنده سياسة المتجر يختفي.
      const byKey = new Map(ctx.facts.map((f) => [f.key as string, f]));
      const items = groundedItems(s.items, ctx.facts)
        .map((it) => {
          const f = it.fact ? byKey.get(it.fact) ?? (it.fact === "free_shipping_over" ? byKey.get("free_shipping") : undefined) : undefined;
          return f ? { ...it, icon: f.icon, title: f.title, text: f.detail } : it;
        })
        .slice(0, 4);
      if (items.length < 2) return null;
      return <Block.TrustBadges key={s.id} s={{ ...s, items }} />;
    }

    case "brand_story":
      return <Block.BrandStory key={s.id} s={s} />;

    case "testimonials":
      return <Block.Testimonials key={s.id} s={s} ctx={ctx} />;

    case "faq": {
      // سؤال يجيب بسياسة لم تعد صحيحة يُحذف عند العرض.
      const items = groundedItems(s.items.map((f) => ({ ...f, title: f.q, text: f.a })), ctx.facts, "drop").map(({ q, a }) => ({ q, a }));
      if (!items.length) return null;
      return <Block.Faq key={s.id} s={{ ...s, items }} />;
    }

    case "about":
      return <Block.About key={s.id} s={s} />;

    case "bundle":
      return <Block.Bundle key={s.id} s={s} ctx={ctx} />;

    case "video":
      return <Block.Video key={s.id} s={s} />;

    case "contact":
      return <Block.Contact key={s.id} s={s} ctx={ctx} />;

    case "custom_blocks":
      return <Block.CustomBlocks key={s.id} s={s} />;

    case "steps": {
      // خطوة تعِد بسياسة لم تعد صحيحة (معاينة، دفع عند الاستلام، استبدال) تُحذف عند العرض.
      const items = groundedItems(s.items, ctx.facts, "drop");
      if (items.length < 2) return null;
      return <Block.Steps key={s.id} s={{ ...s, items }} />;
    }

    default:
      return null;
  }
}