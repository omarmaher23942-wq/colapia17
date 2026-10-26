"use client";

// WishlistView — صفحة المفضلة: تجلب المنتجات حيّة (سعر وتوفر) وتعرضها ببطاقات المتجر.
// - مشاركة القائمة برابط (واتساب/نسخ) وعرض قائمة مشاركة من صديق (للقراءة) مع «حفظها في مفضلتي».
// - «إضافة المتاح للسلة» دفعة واحدة، وتصفية المتاح فقط، وشارة انخفاض السعر منذ أول مرة رآها الزائر.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Heart, Share2, ShoppingBag, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { useWishlist } from "@/store/wishlist";
import { useCart } from "@/store/cart";
import { ProductCard, type ProductCardProduct } from "./ProductCard";
import { isSoldOut } from "@/lib/card-ui";
import { parseSharedWishlist, priceDrop, wishlistShareUrl } from "@/lib/shopper-ui";
import { formatEgp } from "@/lib/money";
import { cn } from "@/lib/utils";

export function WishlistView() {
  const sp = useSearchParams();
  const shared = useMemo(() => parseSharedWishlist(sp.get("items")), [sp]);
  const isShared = shared.length > 0;
  const mine = useWishlist((s) => s.slugs);
  const prices = useWishlist((s) => s.prices);
  const notePrices = useWishlist((s) => s.notePrices);
  const addMany = useWishlist((s) => s.addMany);
  const remove = useWishlist((s) => s.remove);
  const addToCart = useCart((s) => s.add);
  const slugs = isShared ? shared : mine;
  const [rows, setRows] = useState<ProductCardProduct[] | null>(null);
  const [onlyAvail, setOnlyAvail] = useState(false);
  const key = slugs.join(",");

  useEffect(() => {
    if (!key) {
      setRows([]);
      return;
    }
    let live = true;
    fetch(`/api/storefront/wishlist?slugs=${encodeURIComponent(key)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { products: [] }))
      .then((j: { products?: ProductCardProduct[] }) => {
        if (!live) return;
        const found = j.products ?? [];
        setRows(found);
        if (isShared) return;
        notePrices(Object.fromEntries(found.map((p) => [p.slug, p.pricePiasters])));
        // منتج حُذف أو أُخفي من المتجر يخرج من القائمة بدل أن يبقى معلقاً.
        const alive = new Set(found.map((p) => p.slug));
        for (const s of key.split(",")) if (!alive.has(s)) remove(s);
      })
      .catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, [key, remove, notePrices, isShared]);

  const shown = (rows ?? []).filter((p) => !onlyAvail || !isSoldOut(p));
  const addable = (rows ?? []).filter((p) => !isSoldOut(p) && !(p.optionNames?.length));
  const withOptions = (rows ?? []).filter((p) => !isSoldOut(p) && (p.optionNames?.length ?? 0) > 0).length;

  const share = async () => {
    const url = wishlistShareUrl(window.location.origin, mine);
    try {
      if (navigator.share) await navigator.share({ title: "مفضلتي", url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("تم نسخ رابط القائمة");
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") toast.error("تعذّرت المشاركة");
    }
  };

  const addAll = () => {
    for (const p of addable) addToCart({ productId: p.id, slug: p.slug, name: p.name, imageUrl: p.images[0]?.url, unitPiasters: p.pricePiasters, maxQty: p.trackStock ? p.stock : null }, 1);
    toast.success(`أُضيف ${addable.length} إلى السلة${withOptions ? `، و${withOptions} منها يحتاج اختيار المقاس أو اللون` : ""}`);
  };

  return (
    <div className="container-x py-6 md:py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl">{isShared ? "قائمة مشاركة معكم" : "المفضلة"}{rows?.length ? ` (${rows.length})` : ""}</h1>
        {rows?.length ? (
          <div className="flex flex-wrap gap-2">
            {isShared ? (
              <button type="button" onClick={() => (addMany(shared), toast.success("حُفظت القائمة في مفضلتكم"))} className="s-btn-ghost h-10 gap-1.5 px-4 text-[13px]">
                <Heart className="size-4" aria-hidden="true" /> حفظها في مفضلتي
              </button>
            ) : (
              <button type="button" onClick={share} className="s-btn-ghost h-10 gap-1.5 px-4 text-[13px]">
                <Share2 className="size-4" aria-hidden="true" /> مشاركة القائمة
              </button>
            )}
            {addable.length ? (
              <button type="button" onClick={addAll} className="s-btn h-10 gap-1.5 px-4 text-[13px]">
                <ShoppingBag className="size-4" aria-hidden="true" /> إضافة المتاح للسلة ({addable.length})
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {rows && rows.length > 1 && rows.some((p) => isSoldOut(p)) ? (
        <label className="mb-4 inline-flex min-h-10 cursor-pointer items-center gap-2 text-[13px] font-bold">
          <input type="checkbox" checked={onlyAvail} onChange={(e) => setOnlyAvail(e.target.checked)} className="size-4 accent-[var(--primary)]" /> المتوفر فقط
        </label>
      ) : null}
      {rows === null ? (
        <p className="py-20 text-center opacity-60" aria-live="polite">
          جارٍ التحميل…
        </p>
      ) : shown.length ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((p) => {
            const drop = isShared ? null : priceDrop(prices[p.slug], p.pricePiasters);
            return (
              <div key={p.id} className={cn("flex flex-col gap-1.5")}>
                <ProductCard product={p} />
                {drop ? (
                  <p className="flex items-center gap-1 text-[12px] font-bold text-success">
                    <TrendingDown className="size-3.5" aria-hidden="true" /> انخفض {drop.percent}% عن {formatEgp(drop.fromPiasters)}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid place-items-center gap-4 py-20 text-center">
          <Heart className="size-10 opacity-30" strokeWidth={1.25} aria-hidden="true" />
          <p className="max-w-sm opacity-70">{rows.length ? "لا يوجد منتج متوفر في القائمة حالياً." : "لم تضيفوا أي منتج للمفضلة بعد. اضغطوا على القلب في أي منتج لحفظه هنا."}</p>
          <Link href="/search" className="s-btn">
            تصفح المنتجات
          </Link>
        </div>
      )}
    </div>
  );
}
