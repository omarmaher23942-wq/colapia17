"use client";

// WishlistView — صفحة المفضلة: تجلب المنتجات المحفوظة حيّة (سعر وتوفر) وتعرضها ببطاقات المتجر.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { useWishlist } from "@/store/wishlist";
import { ProductCard, type ProductCardProduct } from "./ProductCard";

export function WishlistView() {
  const slugs = useWishlist((s) => s.slugs);
  const remove = useWishlist((s) => s.remove);
  const [rows, setRows] = useState<ProductCardProduct[] | null>(null);
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
        // منتج حُذف أو أُخفي من المتجر يخرج من القائمة بدل أن يبقى معلقاً.
        const alive = new Set(found.map((p) => p.slug));
        for (const s of key.split(",")) if (!alive.has(s)) remove(s);
      })
      .catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, [key, remove]);

  return (
    <div className="container-x py-8">
      <h1 className="mb-6 text-xl">المفضلة{rows?.length ? ` (${rows.length})` : ""}</h1>
      {rows === null ? (
        <p className="py-20 text-center opacity-60" aria-live="polite">
          جارٍ التحميل…
        </p>
      ) : rows.length ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {rows.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="grid place-items-center gap-4 py-20 text-center">
          <Heart className="size-10 opacity-30" strokeWidth={1.25} aria-hidden="true" />
          <p className="opacity-70">لم تضيفوا أي منتج للمفضلة بعد. اضغطوا على القلب في أي منتج لحفظه هنا.</p>
          <Link href="/search" className="s-btn">
            تصفح المنتجات
          </Link>
        </div>
      )}
    </div>
  );
}
