"use client";

// QuickView — ورقة سفلية (موبايل) / نافذة (حاسوب) لاختيار اللون والمقاس والكمية دون مغادرة الصفحة.
// <dialog> أصلي بـ showModal() في الطبقة العليا ومحمول داخل .storefront، فلا يغطيه شيء ولا يحبسه سياق تكديس.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/store/cart";
import { useCopy } from "./StoreProvider";
import { Price } from "./Price";
import { cn } from "@/lib/utils";
import { orderedOptionValues, swatchColor } from "@/lib/pdp";
import type { ProductCardProduct } from "./ProductCard";

type V = { id: string; optionValues: string[]; pricePiasters: number | null; stock: number | null; isAvailable: boolean; imageUrl: string | null; sortOrder?: number };

export function QuickView({ product: p, onClose }: { product: ProductCardProduct; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [host, setHost] = useState<Element | null>(null);
  const t = useCopy();
  const add = useCart((s) => s.add);
  const closeCart = useCart((s) => s.close);
  const [qty, setQty] = useState(1);
  const [variants, setVariants] = useState<V[] | null>(null);
  const names = p.optionNames ?? [];
  const [sel, setSel] = useState<string[]>(names.map(() => ""));

  useLayoutEffect(() => setHost(document.querySelector(".storefront") ?? document.body), []);
  useEffect(() => {
    const d = ref.current;
    if (!d || !host) return;
    if (!d.open) d.showModal();
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev;
      if (d.open) d.close();
    };
  }, [host]);
  useEffect(() => {
    const ac = new AbortController();
    fetch(`/api/storefront/variants?product=${encodeURIComponent(p.id)}`, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : { variants: [] }))
      .then((j: { variants?: V[] }) => setVariants(j.variants ?? []))
      .catch(() => setVariants([]));
    return () => ac.abort();
  }, [p.id]);

  const chosen = variants?.find((v) => v.optionValues.every((val, i) => val === sel[i]));
  const valuesFor = useCallback((i: number) => orderedOptionValues(i, names[i]!, variants ?? [], p.optionMeta ?? []), [variants, names, p.optionMeta]);
  const ok = (i: number, val: string) =>
    (variants ?? []).some((v) => v.optionValues[i] === val && v.isAvailable && (!p.trackStock || v.stock === null || v.stock > 0) && v.optionValues.every((ov, k) => k === i || !sel[k] || ov === sel[k]));
  const price = chosen?.pricePiasters ?? p.pricePiasters;
  const needs = names.length > 0 && !chosen;
  const stock = p.trackStock ? (chosen ? chosen.stock : null) : null;
  const maxQty = stock === null ? 20 : Math.max(1, Math.min(20, stock));
  useEffect(() => setQty((q) => Math.min(q, maxQty)), [maxQty]);
  const unavailable = !!chosen && (!chosen.isAvailable || (p.trackStock && chosen.stock !== null && chosen.stock <= 0));
  const img = chosen?.imageUrl ?? p.images[0]?.url;
  const loading = variants === null && names.length > 0;
  const hex = useMemo(() => (name: string, val: string) => swatchColor(name, val, p.optionMeta ?? []), [p.optionMeta]);

  const onAdd = () => {
    if (needs) return void toast.error(`يلزم اختيار ${names.filter((_, i) => !sel[i]).join(" و")} أولاً`);
    if (unavailable) return;
    add(
      {
        productId: p.id,
        variantId: chosen?.id,
        slug: p.slug,
        name: p.name,
        imageUrl: img,
        unitPiasters: price,
        variantLabel: chosen?.optionValues.join(" / "),
        maxQty: p.trackStock ? (chosen ? chosen.stock : p.stock) : null,
      },
      qty
    );
    toast.success(`${p.name} في السلة`);
    onClose();
  };

  if (!host) return null;
  return createPortal(
    <dialog
      ref={ref}
      aria-label={p.name}
      className="clp-sheet"
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="clp-sheet-panel" dir="rtl">
        <div className="grid gap-5 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:p-5">
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl" style={{ background: "var(--muted)" }}>
            {img ? <Image src={img} alt={p.name} fill sizes="(max-width:640px) 90vw, 360px" className="object-cover" /> : null}
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-black leading-snug">{p.name}</h2>
              <button type="button" onClick={onClose} aria-label="إغلاق" className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2">
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <Price price={price} compareAt={chosen ? null : p.compareAtPiasters} size="lg" />
            {loading ? (
              <div className="space-y-3" aria-busy="true" aria-label="جارٍ تحميل الخيارات">
                {names.map((n) => (
                  <div key={n} className="space-y-2">
                    <div className="h-3 w-20 animate-pulse rounded" style={{ background: "var(--muted)" }} />
                    <div className="flex gap-2">
                      {[0, 1, 2, 3].map((k) => (
                        <div key={k} className="h-10 w-12 animate-pulse rounded-full" style={{ background: "var(--muted)" }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              names.map((name, i) => (
                <div key={name}>
                  <p className="mb-2 text-xs font-bold">
                    {name}: <span className="font-normal opacity-70">{sel[i] || "اختيار"}</span>
                  </p>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={name}>
                    {valuesFor(i).map((val) => {
                      const able = ok(i, val);
                      const on = sel[i] === val;
                      const c = hex(name, val);
                      return (
                        <button
                          key={val}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          aria-label={able ? val : `${val} (نفد)`}
                          onClick={() => setSel((s) => s.map((x, k) => (k === i ? val : x)))}
                          className={cn(
                            "inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border-2 px-3.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2",
                            on ? "border-[var(--primary)] text-[var(--primary)]" : "border-[var(--border)]",
                            !able && "line-through opacity-45"
                          )}
                        >
                          {c ? <span className="size-4 rounded-full border" style={{ background: c, borderColor: "var(--border)" }} aria-hidden="true" /> : null}
                          {val}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
            <div className="mt-auto flex items-center gap-3 pt-2">
              <div className="flex items-center overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)" }}>
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} className="grid size-11 place-items-center disabled:opacity-40" aria-label="تقليل الكمية">
                  <Minus className="size-4" aria-hidden="true" />
                </button>
                <span className="w-8 text-center text-sm font-black tabular-nums" aria-live="polite">
                  {qty}
                </span>
                <button type="button" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={qty >= maxQty} className="grid size-11 place-items-center disabled:opacity-40" aria-label="زيادة الكمية">
                  <Plus className="size-4" aria-hidden="true" />
                </button>
              </div>
              <button type="button" onClick={onAdd} disabled={loading || unavailable} className="s-btn h-12 flex-1">
                {unavailable ? t("soldOut") : t("addToCart")}
              </button>
            </div>
            <Link
              href={`/p/${encodeURIComponent(p.slug)}`}
              onClick={() => closeCart()}
              className="text-center text-xs font-bold underline-offset-4 hover:underline"
            >
              كل التفاصيل
            </Link>
          </div>
        </div>
      </div>
    </dialog>,
    host
  );
}
