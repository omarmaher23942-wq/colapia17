"use client";

// «شوهد مؤخراً»: يحفظ على الجهاز روابط (slugs) المنتجات المشاهدة بمفتاح خاص بكل متجر، ويجلب أسعارها وتوفرها الحالية
// من /api/storefront/wishlist فلا يعرض سعراً قديماً ولا منتجاً محذوفاً.
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatEgp } from "@/lib/money";
import { useStore as useStorefront } from "@/components/storefront/StoreProvider";

type Live = { id: string; slug: string; name: string; pricePiasters: number; images: { url: string }[] };
const MAX_ITEMS = 12;

function read(key: string): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function RecentlyViewed({ currentSlug }: { currentSlug: string }) {
  const { storeId } = useStorefront();
  const [items, setItems] = useState<Live[]>([]);

  useEffect(() => {
    const key = `clp-recent2:${storeId}`;
    const prev = read(key).filter((x) => x !== currentSlug);
    try {
      localStorage.setItem(key, JSON.stringify([currentSlug, ...prev].slice(0, MAX_ITEMS)));
    } catch {
      // التخزين معطّل في التصفح الخاص: الميزة اختيارية.
    }
    const slugs = prev.slice(0, 8);
    if (!slugs.length) return;
    const ctl = new AbortController();
    fetch(`/api/storefront/wishlist?slugs=${encodeURIComponent(slugs.join(","))}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : { products: [] }))
      .then((d: { products?: Live[] }) => setItems(d.products ?? []))
      .catch(() => {});
    return () => ctl.abort();
  }, [currentSlug, storeId]);

  if (!items.length) return null;
  return (
    <section className="mt-16" aria-labelledby="recent-title">
      <h2 id="recent-title" className="mb-6 font-heading text-xl font-black">
        شوهد مؤخراً
      </h2>
      <div className="hide-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4">
        {items.map((x) => (
          <Link key={x.id} href={`/p/${encodeURIComponent(x.slug)}`} className="w-36 shrink-0 snap-start focus-visible:outline-none focus-visible:ring-2">
            <div className="relative aspect-square overflow-hidden rounded-xl" style={{ background: "var(--muted)" }}>
              {x.images[0] ? <Image src={x.images[0].url} alt="" fill sizes="144px" className="object-cover" /> : null}
            </div>
            <p className="mt-2 line-clamp-1 text-sm font-semibold">{x.name}</p>
            <p className="text-xs tabular-nums opacity-70">{formatEgp(x.pricePiasters)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
