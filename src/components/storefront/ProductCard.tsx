"use client";

// ProductCard.tsx — بطاقة المنتج (Core). الشكل من توكنات التصميم (.s-card .s-media .s-price .s-badge)، والمنطق من lib/card-ui:
// صورة ثانية عند مرور الماوس (للحاسوب فقط)، حتى 4 ألوان حقيقية، تقييم بنجوم من 3 تقييمات فأكثر، شارات صادقة،
// إضافة سريعة للمنتج البسيط، وورقة اختيار سريعة للمنتج ذي المقاسات والألوان.
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus, ShoppingBag, Check, Star } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/store/cart";
import { useCopy, useStore } from "./StoreProvider";
import { Price } from "./Price";
import { WishlistButton } from "./WishlistButton";
import { QuickView } from "./QuickView";
import { cardBadges, cardRating, cardSwatches, effectiveStock, isSoldOut } from "@/lib/card-ui";
import { arCount, NOUN } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Product } from "@/server/repos/catalog";

export type ProductCardProduct = Product & {
  images: Array<{ id?: string; url: string; alt?: string | null }>;
  videoUrl?: string | null;
  isSpotlight?: boolean | null;
  categoryName?: string | null;
  variants?: Array<{ id: string; isAvailable: boolean; stock: number | null; optionValues?: string[]; sortOrder?: number }>;
  isBestSeller?: boolean;
};

export function ProductCard({ product: p, size = "md", priority = false }: { product: ProductCardProduct; size?: "md" | "lg"; priority?: boolean }) {
  const { conversion, design, cardStyle } = useStore();
  const t = useCopy();
  const add = useCart((s) => s.add);
  const [quickOpen, setQuickOpen] = useState(false);
  const [added, setAdded] = useState(false);

  const href = `/p/${encodeURIComponent(p.slug)}`;
  const primary = p.images[0];
  const second = p.images[1];
  const stock = effectiveStock(p);
  const out = isSoldOut(p);
  const lowStock = conversion.lowStockAlert.enabled && typeof stock === "number" && stock > 0 && stock <= conversion.lowStockAlert.threshold;
  const badges = cardBadges(p);
  const swatches = cardSwatches(p);
  const rating = cardRating(p);
  const overlay = cardStyle === "overlay";
  const hasOptions = (p.optionNames?.length ?? 0) > 0;
  const BADGE_LABEL = { soldOut: t("soldOut"), sale: t("saleBadge"), new: "جديد", best: t("bestSellerBadge") } as const;

  const onAdd = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (out) return;
    if (hasOptions) return void setQuickOpen(true);
    add({ productId: p.id, slug: p.slug, name: p.name, imageUrl: primary?.url, unitPiasters: p.pricePiasters, maxQty: p.trackStock ? p.stock : null });
    setAdded(true);
    toast.success(`${p.name} في السلة`);
    window.setTimeout(() => setAdded(false), 1600);
  };

  const quick = design.card.quickAdd;
  const sizes = size === "lg" ? "(max-width: 768px) 100vw, 50vw" : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw";

  return (
    <>
      <article className={cn("s-card group relative flex h-full flex-col overflow-hidden", overlay && "s-card-overlay")} data-out={out ? "1" : undefined}>
        <Link href={href} className="s-media block" aria-label={p.name}>
          {primary ? (
            <>
              <Image src={primary.url} alt={primary.alt ?? p.name} fill sizes={sizes} priority={priority} className="!static" />
              {second ? <Image src={second.url} alt="" fill sizes={sizes} className="!absolute opacity-0 transition-opacity duration-300 [@media(hover:hover)]:group-hover:opacity-100" aria-hidden="true" /> : null}
            </>
          ) : (
            <span className="grid h-full w-full place-items-center opacity-40" aria-hidden="true">
              <ShoppingBag className="size-10" strokeWidth={1.25} />
            </span>
          )}
          {badges.length ? (
            <span className="pointer-events-none absolute start-2.5 top-2.5 flex flex-col items-start gap-1.5">
              {badges.map((b) => (
                <span key={b.key} className="s-badge" data-tone={b.tone === "primary" ? undefined : b.tone}>
                  {BADGE_LABEL[b.key]}
                  {b.key === "sale" && b.pct ? ` ${b.pct}%` : ""}
                </span>
              ))}
            </span>
          ) : null}
        </Link>
        <WishlistButton slug={p.slug} className="absolute end-2.5 top-2.5 z-10" />

        <div className={cn("s-card-info flex flex-1 flex-col gap-1.5 p-3 sm:p-3.5", overlay && "s-card-info-overlay")}>
          {design.card.showCategory && p.categoryName ? <span className="text-[12px] font-bold opacity-70">{p.categoryName}</span> : null}
          <Link href={href} className="focus-visible:outline-none focus-visible:underline">
            <h3 className={cn("line-clamp-2 font-bold leading-snug", size === "lg" ? "text-base sm:text-lg" : "text-[13px] sm:text-sm")}>{p.name}</h3>
          </Link>
          {rating ? (
            <span className="flex items-center gap-1 text-[12px] font-bold" aria-label={`${rating.avg.toFixed(1)} من 5، ${arCount(rating.count, NOUN.review)}`}>
              <Star className="size-3.5 fill-current" style={{ color: "var(--primary)" }} aria-hidden="true" />
              <span className="tabular-nums">{rating.avg.toFixed(1)}</span>
              <span className="opacity-60" aria-hidden="true">
                ({rating.count})
              </span>
            </span>
          ) : null}
          {swatches.items.length ? (
            <span className="flex items-center gap-1" role="img" aria-label={`ألوان متاحة: ${swatches.items.map((s) => s.label).join("، ")}`}>
              {swatches.items.map((s) => (
                <span key={s.label} className="size-3.5 rounded-full border" style={{ background: s.color, borderColor: "var(--border)" }} title={s.label} />
              ))}
              {swatches.more ? <span className="text-[12px] font-bold opacity-70">+{swatches.more}</span> : null}
            </span>
          ) : null}
          {lowStock ? <span className="text-[12px] font-bold text-[var(--danger)]">{t("lowStock", { n: stock as number })}</span> : null}
          <div className="mt-auto flex items-center justify-between gap-2 pt-1">
            <Price price={p.pricePiasters} compareAt={p.compareAtPiasters} size={size === "lg" ? "md" : "sm"} showSavings={false} />
            {quick === "icon" && !out ? (
              <button type="button" onClick={onAdd} aria-label={hasOptions ? `اختيار خيارات ${p.name}` : `${t("addToCart")}: ${p.name}`} className="s-btn !min-h-0 !size-11 !rounded-full !p-0">
                {added ? <Check className="size-4" strokeWidth={2.5} /> : <Plus className="size-4" strokeWidth={2.5} />}
              </button>
            ) : null}
          </div>
          {quick === "button" && !out ? (
            <button type="button" onClick={onAdd} className="s-btn mt-2 w-full !min-h-11 text-[13px]">
              {added ? <Check className="size-4" strokeWidth={2.5} /> : null}
              {hasOptions ? t("buyNow") : t("addToCart")}
            </button>
          ) : null}
        </div>
      </article>

      {quickOpen ? <QuickView product={p} onClose={() => setQuickOpen(false)} /> : null}
    </>
  );
}
