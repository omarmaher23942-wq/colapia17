"use client";

// CartLive — السلة بحقيقة الخادم: عند فتح السلة وتغيّرها نسأل /api/storefront/cart-check فنعرض التوفر والأسعار الفعلية والخصومات
// التلقائية وتقدّم الشحن المجاني واقتراحات «أكملوا الإطلالة». ما يتغير سعره أو كميته المتاحة يُطابَق تلقائياً مع إشعار، وما لم يعد
// متاحاً يُسمّى صراحة مع زر «إزالة». ما تحفظه السلة على الجهاز تقدير فقط.
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Gift, Plus, Sparkles, Tag, Truck, X } from "lucide-react";
import { itemKey, useCart } from "@/store/cart";
import { useWishlist } from "@/store/wishlist";
import { useCopy, useStore } from "./StoreProvider";
import { clearPromo, readPromo, savePromo } from "./PromoFromLink";
import { formatEgp } from "@/lib/money";
import { governorateName } from "@/lib/egypt";
import { freeShippingProgress } from "@/lib/pricing/engine";
import type { CartCheckResult, LineCheck } from "@/server/cart-check";

const SW = 1.75;

export type CartNotice = { id: string; text: string; key?: string; removable?: boolean };

export function useCartLive(active: boolean) {
  const { subdomain } = useStore();
  const items = useCart((s) => s.items);
  const governorate = useCart((s) => s.customer?.governorate);
  const reconcile = useCart((s) => s.reconcile);
  const [data, setData] = useState<CartCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [notices, setNotices] = useState<CartNotice[]>([]);
  const [code, setCode] = useState("");
  const seq = useRef(0);

  useEffect(() => setCode(readPromo(subdomain) ?? ""), [subdomain]);

  const sig = useMemo(() => JSON.stringify(items.map((i) => [itemKey(i), i.qty])) + (governorate ?? "") + code, [items, governorate, code]);

  useEffect(() => {
    if (!active || !items.length) {
      setData(null);
      return;
    }
    const mine = ++seq.current;
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/storefront/cart-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ctrl.signal,
          body: JSON.stringify({
            items: items.map((i) => ({ productId: i.productId, variantId: i.variantId, qty: i.qty, unitPiasters: i.unitPiasters, bundleId: i.bundleId })),
            governorate: governorate || undefined,
            discountCode: code || undefined,
          }),
        });
        if (!res.ok) throw new Error("check");
        const json = (await res.json()) as { ok: boolean } & CartCheckResult;
        if (mine !== seq.current || !json.ok) return;
        setData(json);

        const fixes: Parameters<typeof reconcile>[0] = [];
        const found: CartNotice[] = [];
        for (const l of json.lines) {
          const it = items.find((i) => itemKey(i) === l.key);
          if (!it) continue;
          if (l.status === "price_changed" && l.unit !== undefined) {
            fixes.push({ key: l.key, unitPiasters: l.unit, maxQty: l.maxQty });
            found.push({ id: `p:${l.key}`, text: `تغيّر سعر «${it.name}» إلى ${formatEgp(l.unit)}` });
          } else if (l.status === "qty_limited" && l.maxQty != null) {
            fixes.push({ key: l.key, qty: l.maxQty, maxQty: l.maxQty });
            found.push({ id: `q:${l.key}`, text: `المتاح من «${it.name}» ${l.maxQty} فقط، وعدّلنا الكمية` });
          } else if (l.status === "removed" || l.status === "unavailable" || l.status === "out_of_stock") {
            found.push({ id: `r:${l.key}`, key: l.key, removable: true, text: l.status === "out_of_stock" ? `«${it.name}» نفد من المخزون` : `«${it.name}» لم يعد متاحاً` });
          }
        }
        if (fixes.length) reconcile(fixes);
        if (found.length) setNotices((n) => [...n.filter((x) => !found.some((f) => f.id === x.id)), ...found]);
      } catch {
        /* الخادم لا يجيب: تبقى أرقام الجهاز تقديرية والدفع يعيد الحساب */
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    }, 280);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, sig]);

  const dismiss = useCallback((id: string) => setNotices((n) => n.filter((x) => x.id !== id)), []);
  const applyCode = useCallback(
    (c: string) => {
      const v = c.trim().toUpperCase();
      if (!v) {
        clearPromo(subdomain);
        setCode("");
      } else {
        savePromo(subdomain, v);
        setCode(v);
      }
    },
    [subdomain]
  );

  const statusOf = useCallback((key: string): LineCheck | undefined => data?.lines.find((l) => l.key === key), [data]);
  return { data, loading, notices, dismiss, code, applyCode, statusOf };
}

/** تنبيهات السلة: ما تغيّر تلقائياً، وما لم يعد متاحاً مع «إزالة». */
export function CartNotices({ notices, dismiss }: { notices: CartNotice[]; dismiss: (id: string) => void }) {
  const remove = useCart((s) => s.remove);
  if (!notices.length) return null;
  return (
    <ul className="space-y-2" aria-live="polite">
      {notices.map((n) => (
        <li key={n.id} className="flex items-start gap-2 rounded-xl border px-3 py-2 text-[12.5px] leading-6" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--muted) 70%, transparent)" }}>
          <AlertTriangle className="mt-1 size-4 shrink-0" strokeWidth={SW} aria-hidden="true" />
          <span className="min-w-0 flex-1">{n.text}</span>
          {n.removable && n.key ? (
            <button
              type="button"
              onClick={() => {
                remove(n.key!);
                dismiss(n.id);
              }}
              className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold underline"
            >
              إزالة
            </button>
          ) : (
            <button type="button" onClick={() => dismiss(n.id)} aria-label="إخفاء التنبيه" className="grid size-6 shrink-0 place-items-center rounded-md opacity-60 hover:opacity-100">
              <X className="size-3.5" strokeWidth={SW} aria-hidden="true" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** تقدّم الشحن المجاني: يعرف الشحن الموحد والمناطق والحد الأدنى، ويُحسب على المجموع بعد الخصم. */
export function FreeShippingMeter({ data, localSubtotal }: { data: CartCheckResult | null; localSubtotal: number }) {
  const { shipping } = useStore();
  const t = useCopy();
  const p = data?.quote?.progress ?? freeShippingProgress({ freeOverPiasters: shipping.freeOverPiasters, flatRatePiasters: shipping.flatRatePiasters, afterDiscount: localSubtotal });
  if (p.kind === "none") return null;
  const reached = p.kind === "always" || p.kind === "reached";
  const percent = p.kind === "progress" ? p.percent : 100;
  return (
    <div className="text-sm" dir="rtl">
      <p className="flex items-center gap-2 text-[12.5px] font-bold">
        {reached ? <Sparkles className="size-4 shrink-0" strokeWidth={2.25} aria-hidden="true" style={{ color: "var(--primary)" }} /> : <Truck className="size-4 shrink-0" strokeWidth={SW} aria-hidden="true" />}
        <span>{p.kind === "always" ? "الشحن مجاني على كل الطلبات" : p.kind === "reached" ? t("freeShippingReached") : t("freeShippingGap", { amount: formatEgp(p.remaining) })}</span>
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ background: "var(--border)" }} role="progressbar" aria-label="التقدم نحو الشحن المجاني" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <div className="h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${percent}%`, background: "var(--primary)" }} />
      </div>
      {p.kind === "progress" ? <p className="mt-1 text-[11px] opacity-60">يُحتسب على مجموع الطلب بعد الخصم</p> : null}
    </div>
  );
}

/** ملخص السلة: الخصومات التلقائية، حقل كود الخصم، تقدير الشحن، الإجمالي، وتلميحات «أضيفوا X لتحصلوا على…». */
export function CartTotals({ live, localSubtotal }: { live: ReturnType<typeof useCartLive>; localSubtotal: number }) {
  const { data, code, applyCode } = live;
  const governorate = useCart((s) => s.customer?.governorate);
  const q = data?.quote ?? null;
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const subtotal = q?.subtotal ?? localSubtotal;
  const gifts = q?.lines.filter((l) => l.isGift) ?? [];
  const nudge = q?.nudges.find((n) => n.kind !== "free_shipping");
  return (
    <div className="space-y-2.5 text-sm">
      {nudge ? (
        <p className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] font-bold" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}>
          {nudge.kind === "gift" ? <Gift className="size-4 shrink-0" strokeWidth={SW} aria-hidden="true" /> : <Tag className="size-4 shrink-0" strokeWidth={SW} aria-hidden="true" />}
          <span>
            أضيفوا {formatEgp(nudge.remainingPiasters)} لتحصلوا على {nudge.label}
          </span>
        </p>
      ) : null}

      <div className="flex justify-between">
        <span className="opacity-70">المجموع</span>
        <span className="font-mono tabular-nums">{formatEgp(subtotal)}</span>
      </div>
      {q?.adjustments.map((a, i) => (
        <div key={i} className="flex justify-between gap-3 text-success">
          <span className="min-w-0">{a.label}</span>
          <span className="shrink-0 font-mono tabular-nums">- {formatEgp(a.amount)}</span>
        </div>
      ))}
      {gifts.map((g) => (
        <div key={g.key} className="flex items-center gap-2 text-success">
          <Gift className="size-4 shrink-0" strokeWidth={SW} aria-hidden="true" />
          <span>هدية مجانية: {g.name.replace(/^هدية:\s*/, "")}</span>
        </div>
      ))}
      <div className="flex justify-between">
        <span className="opacity-70">{governorate && q?.shipping != null ? `الشحن إلى ${governorateName(governorate)}` : "الشحن"}</span>
        <span className="font-mono tabular-nums">{q?.shipping == null ? "يُحسب عند إكمال الطلب" : q.shipping === 0 ? "مجاني" : formatEgp(q.shipping)}</span>
      </div>

      {code || open ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            applyCode(draft || code);
            setOpen(false);
          }}
        >
          <label className="sr-only" htmlFor="cart-code">كود الخصم</label>
          <input id="cart-code" className="s-input h-10 min-w-0 flex-1 uppercase" dir="ltr" maxLength={20} placeholder="كود الخصم" value={draft || code} onChange={(e) => setDraft(e.target.value)} />
          <button type="submit" className="s-btn-ghost h-10 shrink-0 px-4 text-xs">تطبيق</button>
          {code ? (
            <button type="button" aria-label="إزالة الكود" className="grid size-10 shrink-0 place-items-center rounded-lg border" style={{ borderColor: "var(--border)" }} onClick={() => { applyCode(""); setDraft(""); }}>
              <X className="size-4" strokeWidth={SW} aria-hidden="true" />
            </button>
          ) : null}
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="text-xs font-bold underline underline-offset-4 opacity-80 hover:opacity-100">
          لديكم كود خصم؟
        </button>
      )}
      {q?.couponError && code ? <p role="alert" className="text-xs font-bold text-danger">{q.couponError}</p> : null}
    </div>
  );
}

/** «أكملوا الإطلالة»: مما يُشترى مع ما في السلة فعلاً. */
export function CrossSell({ data, onNavigate }: { data: CartCheckResult | null; onNavigate?: () => void }) {
  const add = useCart((s) => s.add);
  if (!data?.suggestions.length) return null;
  return (
    <section aria-labelledby="cross-sell" className="space-y-2">
      <h3 id="cross-sell" className="text-sm font-black">أكملوا الإطلالة</h3>
      <ul className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        {data.suggestions.map((s) => (
          <li key={s.id} className="w-32 shrink-0 rounded-xl border p-2" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            <Link href={`/p/${encodeURIComponent(s.slug)}`} onClick={onNavigate} className="relative block aspect-square overflow-hidden rounded-lg" style={{ background: "var(--muted)" }}>
              {s.imageUrl ? <Image src={s.imageUrl} alt={s.name} fill sizes="128px" className="object-cover" /> : null}
            </Link>
            <p className="mt-1.5 line-clamp-2 text-[12px] font-bold leading-5">{s.name}</p>
            <p className="font-mono text-xs tabular-nums opacity-80">{formatEgp(s.pricePiasters)}</p>
            {s.hasOptions ? (
              <Link href={`/p/${encodeURIComponent(s.slug)}`} onClick={onNavigate} className="s-btn-ghost mt-1.5 h-8 w-full text-[11px]">اختيار</Link>
            ) : (
              <button
                type="button"
                onClick={() => add({ productId: s.id, slug: s.slug, name: s.name, imageUrl: s.imageUrl, unitPiasters: s.pricePiasters }, 1)}
                className="s-btn-ghost mt-1.5 h-8 w-full text-[11px]"
                aria-label={`إضافة ${s.name} للسلة`}
              >
                <Plus className="size-3.5" strokeWidth={SW} aria-hidden="true" /> إضافة
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** «احفظ لاحقاً»: ينقل المنتج من السلة إلى المفضلة. */
export function useSaveForLater() {
  const slugs = useWishlist((s) => s.slugs);
  const toggle = useWishlist((s) => s.toggle);
  const remove = useCart((s) => s.remove);
  return useCallback(
    (key: string, slug: string) => {
      if (!slugs.includes(slug)) toggle(slug);
      remove(key);
    },
    [slugs, toggle, remove]
  );
}
