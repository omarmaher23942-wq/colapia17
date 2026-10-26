"use client";

// ProductPurchase.tsx — بلوك الشراء في صفحة المنتج.
// مسار شراء واحد فقط: «اشترِ الآن» يضع المنتج في السلة وينقل العميل لصفحة إتمام الطلب، حيث يختار
// بوضوح متى وكيف يدفع (عند الاستلام أو مقدماً بالتحويل). لا نوافذ طلب سريع تخفي الاختيار أو تفرضه.
// صف الثقة أسفل الأزرار يُشتق من حقائق المتجر الفعلية، فلا يَعِد بما لا يطبقه التاجر.
import { activeTier, deliveryRange, orderedOptionValues, sortedTiers, swatchColor, tierLabel, tierUnitPrice } from "@/lib/pdp";
import { usePdp } from "@/store/pdp";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag, Check, ArrowLeft, Heart, Truck } from "lucide-react";
import { useWishlist } from "@/store/wishlist";
import { toast } from "sonner";
import { Price } from "./Price";
import { Icon } from "./Icon";
import { useCopy, useStore } from "./StoreProvider";
import { useCart } from "@/store/cart";
import { flyToCart } from "./motion";
import { groundedItems } from "@/blueprint/facts";
import { cn } from "@/lib/utils";
import { waLink } from "@/lib/whatsapp";
import { BrandIcon } from "./brand-icons";
import type { Product, Variant } from "@/server/repos/catalog";
import { chartFor, isSizeOption } from "@/lib/size-guide";
import { SizeGuideButton } from "./SizeGuide";
import { StockAlertForm } from "./StockAlertForm";

type PurchaseProduct = Product & { variants: Variant[] };

/** ترتيب الحقائق حسب أهميتها لقرار الشراء في صفحة المنتج. */
const TRUST_ORDER = ["cod", "inspection", "returns", "free_shipping_over", "free_shipping", "fast_delivery", "nationwide", "defect", "wallets"];

export function ProductPurchase({ product: p, zones = [] }: { product: PurchaseProduct; zones?: { governorate: string; min: number; max: number }[] }) {
  const router = useRouter();
  const { conversion, facts, sizeGuide, storeId, subdomain, channels } = useStore();
  const t = useCopy();
  const add = useCart((s) => s.add);
  const items = useCart((s) => s.items);
  const closeCart = useCart((s) => s.close);

  const [sel, setSel] = useState<string[]>(p.optionNames.map(() => ""));
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [missing, setMissing] = useState(false);

  // خيار له قيمة واحدة متاحة فقط (مقاس وحيد مثلاً) يُختار تلقائياً: خطوة أقل قبل الشراء.
  useEffect(() => {
    setSel((cur) =>
      cur.map((v, i) => {
        if (v) return v;
        const vals = [...new Set(p.variants.filter((x) => x.isAvailable).map((x) => x.optionValues[i]).filter((x): x is string => Boolean(x)))];
        return vals.length === 1 ? vals[0]! : v;
      })
    );
  }, [p.variants]);

  const variant = useMemo(() => p.variants.find((v) => v.optionValues.every((val, i) => val === sel[i])), [p.variants, sel]);
  const needsVariant = p.optionNames.length > 0 && !variant;
  const basePrice = variant?.pricePiasters ?? p.pricePiasters;
  const tiers = useMemo(() => sortedTiers(p.volumeTiers), [p.volumeTiers]);
  const price = tierUnitPrice(basePrice, tiers, qty);
  const compareAt = activeTier(tiers, qty) ? basePrice : (variant?.compareAtPiasters ?? p.compareAtPiasters);
  const stock = variant ? variant.stock : p.stock;
  const out = (p.trackStock && stock !== null && stock <= 0) || (variant && !variant.isAvailable);

  // تركيبة موجودة أصلاً (حتى لو نفدت): تبقى قابلة للاختيار مشطوبة، فيظهر «نبلغك أول ما يتوفر» لها بالذات.
  const exists = (i: number, val: string) => p.variants.some((v) => v.optionValues[i] === val && v.optionValues.every((ov, k) => k === i || !sel[k] || ov === sel[k]));
  const sizeChart = useMemo(() => {
    const i = p.optionNames.findIndex(isSizeOption);
    const sizes = i < 0 ? [] : [...new Set(p.variants.map((v) => v.optionValues[i]).filter((x): x is string => Boolean(x)))];
    return chartFor(sizeGuide, p.categoryId, p.optionNames, sizes);
  }, [sizeGuide, p.categoryId, p.optionNames, p.variants]);
  const optionValues = (i: number) => orderedOptionValues(i, p.optionNames[i]!, p.variants, p.optionMeta);
  const maxQty = p.trackStock && stock !== null ? Math.max(1, stock) : 99;
  useEffect(() => setQty((q) => Math.min(q, maxQty)), [maxQty]);
  const available = (i: number, val: string) =>
    p.variants.some(
      (v) =>
        v.optionValues[i] === val &&
        v.isAvailable &&
        (!p.trackStock || v.stock === null || v.stock > 0) &&
        v.optionValues.every((ov, k) => k === i || !sel[k] || ov === sel[k])
    );

  const item = () => ({
    productId: p.id,
    variantId: variant?.id,
    slug: p.slug,
    name: p.name,
    imageUrl: variant?.imageUrl ?? p.images[0]?.url,
    unitPiasters: basePrice, // خصم الكمية يطبّقه محرك التسعير في السلة
    variantLabel: variant?.optionValues.join(" / "),
    maxQty: p.trackStock ? stock : null,
  });

  /** خيار ناقص: رسالة واضحة + تمييز مكان الاختيار، لا صمت. */
  const guard = () => {
    if (!needsVariant) return true;
    setMissing(true);
    toast.error(`يلزم اختيار ${p.optionNames.filter((_, i) => !sel[i]).join(" و")} أولاً`);
    document.querySelector("[data-variant-picker]")?.scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  };

  const onAdd = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!guard()) return;
    add(item(), qty);
    flyToCart(e.currentTarget.closest<HTMLElement>("[data-purchase-block]") ?? e.currentTarget, variant?.imageUrl ?? p.images[0]?.url);
    setAdded(true);
    toast.success(`${p.name} في السلة`);
    setTimeout(() => setAdded(false), 1600);
  };

  const onBuyNow = () => {
    if (!guard()) return;
    // لا نكرر المنتج لو كان في السلة بنفس الاختيار: نذهب مباشرة لإتمام الطلب.
    const inCart = items.some((x) => x.productId === p.id && (x.variantId ?? null) === (variant?.id ?? null));
    if (!inCart) add(item(), qty);
    // الإضافة تفتح درج السلة؛ «شراء الآن» يذهب للدفع مباشرة فلا يبقى الدرج فوق صفحة الدفع.
    closeCart();
    router.push("/checkout");
  };

  // سؤال عن المنتج على واتساب المتجر: الرابط والاختيار الحالي في الرسالة (الرابط بعد التحميل فقط).
  const [pageUrl, setPageUrl] = useState("");
  useEffect(() => setPageUrl(window.location.href.split("?")[0]!), []);
  const chosen = p.optionNames.map((n, i) => (sel[i] ? `${n}: ${sel[i]}` : "")).filter(Boolean).join("، ");
  const askHref = waLink(channels.whatsappNumber, `أهلاً، عندي سؤال عن «${p.name}»${chosen ? ` (${chosen})` : ""}${pageUrl ? `\n${pageUrl}` : ""}`);

  const wished = useWishlist((st) => st.slugs.includes(p.slug));
  const toggleWish = useWishlist((st) => st.toggle);
  const [wishReady, setWishReady] = useState(false);
  useEffect(() => setWishReady(true), []);
  useEffect(() => {
    if (!needsVariant) setMissing(false);
  }, [needsVariant]);

  const setPdp = usePdp((st) => st.set);
  const clearPdp = usePdp((st) => st.clear);
  useEffect(() => {
    setPdp({
      productId: p.id,
      slug: p.slug,
      name: p.name,
      image: variant?.imageUrl ?? p.images[0]?.url ?? "",
      variantId: variant?.id ?? "",
      variantLabel: variant?.optionValues.join(" / ") ?? "",
      price,
      qty,
      stock: p.trackStock ? stock : null,
      out: !!out,
      needsVariant,
      optionNames: p.optionNames,
      buttonsVisible: true,
    });
  }, [setPdp, p.id, p.slug, p.name, p.images, p.trackStock, p.optionNames, variant, price, qty, stock, out, needsVariant]);
  useEffect(() => clearPdp, [clearPdp]);

  // صورة الاختيار: التركيبة المختارة، أو أول تركيبة توافق ما اختاره العميل حتى الآن (اختيار اللون وحده يكفي)،
  // فينتقل معرض الصور إليها (ProductGallery يستمع لـ clp:show-image).
  const selectionUrls = useMemo(() => {
    if (!sel.some(Boolean)) return [] as string[];
    const urls: string[] = [];
    for (const v of p.variants) {
      if (!v.optionValues.every((val, i) => !sel[i] || val === sel[i])) continue;
      for (const u of [v.imageUrl, ...(v.imageUrls ?? [])]) if (u && !urls.includes(u)) urls.push(u);
    }
    return urls;
  }, [sel, p.variants]);
  useEffect(() => {
    // لون له صور: يعرض المعرض صوره وحدها؛ صورة واحدة فقط: ينتقل إليها دون إخفاء البقية؛ بلا اختيار: كل الصور.
    if (selectionUrls.length >= 2) window.dispatchEvent(new CustomEvent("clp:show-image", { detail: { urls: selectionUrls } }));
    else {
      window.dispatchEvent(new CustomEvent("clp:show-image", { detail: { urls: null } }));
      if (selectionUrls[0]) window.dispatchEvent(new CustomEvent("clp:show-image", { detail: { url: selectionUrls[0] } }));
    }
  }, [selectionUrls]);

  // موعد التوصيل: محافظة يتذكرها الجهاز، والحساب على الجهاز بعد التحميل (لا اختلاف hydration).
  const govKey = `clp:gov:${subdomain}`;
  const [gov, setGov] = useState("");
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    try {
      setGov(localStorage.getItem(govKey) ?? "");
    } catch {}
  }, [govKey]);
  const zone = zones.find((z) => z.governorate === gov) ?? null;
  const etaDays = zone ? { min: zone.min, max: zone.max } : zones.length ? { min: Math.min(...zones.map((z) => z.min)), max: Math.max(...zones.map((z) => z.max)) } : null;
  const eta = now && etaDays ? deliveryRange(now, etaDays.min, etaDays.max).text : null;

  // صف الثقة: صياغة التاجر إن كتبها (مفلترة بالحقائق)، وإلا أهم حقائق المتجر الفعلية.
  // المعاينة قبل الدفع (bp.shipping.inspectionAllowed) تظهر دائماً حين يسمح بها المتجر، ولا تظهر أبداً حين لا يسمح.
  const trust = useMemo(() => {
    const inspection = facts.find((f) => f.key === "inspection");
    const inspectionRow = inspection ? { icon: inspection.icon, text: "المعاينة متاحة قبل الدفع" } : null;
    const custom = groundedItems(conversion.productTrustRow.map((r) => ({ ...r, title: r.text })), facts);
    const rows = custom.length
      ? custom.map((r) => ({ icon: r.icon, text: r.text }))
      : facts
          .filter((f) => TRUST_ORDER.includes(f.key) && f.key !== "inspection")
          .sort((a, b) => TRUST_ORDER.indexOf(a.key) - TRUST_ORDER.indexOf(b.key))
          .map((f) => ({ icon: f.icon, text: f.title }));
    const rest = inspectionRow ? rows.filter((r) => !/معاين|فحص|افحص/.test(r.text)) : rows;
    return (inspectionRow ? [inspectionRow, ...rest] : rest).slice(0, 4);
  }, [conversion.productTrustRow, facts]);

  return (
    <div className="mt-5 space-y-5" dir="rtl">
      <Price price={price} compareAt={compareAt} size="lg" showSavings={conversion.showSavings} />

      {p.optionNames.length ? (
        <div data-variant-picker className={cn("space-y-4 rounded-2xl transition", missing && "p-3 ring-2 ring-[var(--danger)]/60")}>
          {p.optionNames.map((name, i) => {
            const values = optionValues(i);
            return (
              <div key={name}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-bold">
                    {name}: <span className={cn("font-normal", sel[i] ? "opacity-70" : missing ? "text-[var(--danger)]" : "opacity-70")}>{sel[i] || "اختيار"}</span>
                  </p>
                  {sizeChart && isSizeOption(name) ? (
                    <SizeGuideButton
                      chart={sizeChart}
                      storeId={storeId}
                      isAvailable={(size) => values.includes(size) && available(i, size)}
                      onPick={(size) => setSel((s) => s.map((x, k) => (k === i ? size : x)))}
                    />
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={name}>
                  {values.map((val) => {
                    const ok = available(i, val);
                    const can = exists(i, val);
                    const on = sel[i] === val;
                    return (
                      <button
                        type="button"
                        key={val}
                        role="radio"
                        aria-checked={on}
                        disabled={!can}
                        aria-label={ok ? val : `${val} (نفد)`}
                        onClick={() => setSel((s) => s.map((x, k) => (k === i ? val : x)))}
                        className={cn(
                          "s-chip relative inline-flex h-11 min-w-[44px] items-center justify-center gap-1.5 border-2 px-3.5 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2",
                          on ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] text-[var(--primary)]" : "border-[var(--border)] hover:border-[var(--foreground)]/40",
                          !can && "cursor-not-allowed line-through opacity-30",
                          can && !ok && "line-through opacity-50"
                        )}
                      >
                        {swatchColor(name, val, p.optionMeta) ? <span className="size-4 rounded-full border" style={{ background: swatchColor(name, val, p.optionMeta)!, borderColor: "var(--border)" }} aria-hidden="true" /> : null}
                        <span>{val}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {tiers.length ? (
        <ul className="flex flex-wrap gap-2" aria-label="خصم الكمية">
          {tiers.map((t) => {
            const on = activeTier(tiers, qty)?.minQty === t.minQty;
            return (
              <li key={t.minQty}>
                <button
                  type="button"
                  onClick={() => setQty(Math.min(t.minQty, maxQty))}
                  disabled={t.minQty > maxQty}
                  className={cn("rounded-full border px-3 py-1.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 disabled:opacity-40", on ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] text-[var(--primary)]" : "border-[var(--border)]")}
                >
                  {tierLabel(t)}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="flex items-center gap-4">
        <span className="text-xs font-bold">الكمية</span>
        <div className="s-input flex items-center overflow-hidden border" style={{ borderColor: "var(--border)" }}>
          <button type="button" className="grid size-11 place-items-center transition-colors hover:bg-[var(--muted)] disabled:opacity-40" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="تقليل الكمية" disabled={qty <= 1}>
            <Minus className="size-3.5" aria-hidden="true" />
          </button>
          <input
            type="text"
            inputMode="numeric"
            aria-label="الكمية"
            value={qty}
            onChange={(e) => {
              const n = Number(e.target.value.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\D/g, ""));
              if (Number.isFinite(n) && n > 0) setQty(Math.min(n, maxQty));
            }}
            onFocus={(e) => e.currentTarget.select()}
            className="h-11 w-12 bg-transparent text-center text-sm font-black tabular-nums outline-none focus-visible:ring-2"
          />
          <button type="button" className="grid size-11 place-items-center transition-colors hover:bg-[var(--muted)] disabled:opacity-40" onClick={() => setQty(Math.min(qty + 1, maxQty))} aria-label="زيادة الكمية" disabled={qty >= maxQty}>
            <Plus className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {p.trackStock && stock !== null && stock > 0 && stock <= 5 && !needsVariant ? (
        <p className="text-xs font-bold" style={{ color: "var(--danger, #b91c1c)" }} role="status">
          متبقي {stock} {stock === 1 ? "قطعة فقط" : "قطع فقط"}
        </p>
      ) : null}

      <div className="flex flex-col gap-2.5 pt-1 sm:flex-row" data-purchase-block>
        <button type="button" onClick={onBuyNow} disabled={!!out} className="s-btn h-12 flex-[2] text-[15px]">
          {out ? t("soldOut") : t("buyNow")}
          {!out ? <ArrowLeft className="size-4" aria-hidden="true" /> : null}
        </button>
        <button type="button" onClick={onAdd} disabled={!!out} className="s-btn-ghost h-12 flex-1">
          {added ? <Check className="size-4" aria-hidden="true" /> : <ShoppingBag className="size-4" aria-hidden="true" />}
          <span>{added ? "في السلة" : t("addToCart")}</span>
        </button>
      </div>

      {out ? <StockAlertForm subdomain={subdomain} productId={p.id} variantId={variant?.id} label={variant ? variant.optionValues.join(" / ") : undefined} /> : null}

      {trust.length ? (
        <ul className={cn("grid gap-2 rounded-2xl border p-3.5 text-[12px] font-bold", trust.length === 1 ? "grid-cols-1" : "grid-cols-2")} style={{ background: "color-mix(in srgb, var(--muted) 60%, transparent)", borderColor: "var(--border)" }}>
          {trust.map((r, i) => (
            <li key={i} className={cn("flex items-center gap-2", trust.length === 3 && i === 2 && "col-span-2")}>
              <Icon name={r.icon} className="size-4 shrink-0 text-[var(--primary)]" />
              {r.text}
            </li>
          ))}
        </ul>
      ) : null}

      {zones.length ? (
        <div className="rounded-2xl border p-3.5 text-sm" style={{ borderColor: "var(--border)" }}>
          <p className="flex items-center gap-2 font-bold">
            <Truck className="size-4 shrink-0 text-[var(--primary)]" aria-hidden="true" />
            {eta ? <span>{gov && zone ? "يصل" : "يصل غالباً"} {eta}</span> : <span>موعد التوصيل</span>}
          </p>
          <label className="mt-2 flex items-center gap-2 text-xs">
            <span className="opacity-70">المحافظة</span>
            <select
              value={gov}
              onChange={(e) => {
                setGov(e.target.value);
                try {
                  localStorage.setItem(govKey, e.target.value);
                } catch {}
              }}
              className="s-input h-10 min-w-0 flex-1 rounded-xl border bg-transparent px-2 text-base"
              style={{ borderColor: "var(--border)" }}
            >
              <option value="">اختيار المحافظة</option>
              {zones.map((z) => (
                <option key={z.governorate} value={z.governorate}>
                  {z.governorate}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {askHref ? (
          <a href={askHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold opacity-80 transition-opacity hover:opacity-100">
            <BrandIcon brand="whatsapp" className="size-3.5" />
            <span>سؤال عن المنتج على واتساب</span>
          </a>
        ) : null}
        <button type="button" onClick={() => toggleWish(p.slug)} aria-pressed={wishReady && wished} className="inline-flex items-center gap-1.5 text-xs font-bold opacity-80 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2">
          <Heart className="size-3.5" fill={wishReady && wished ? "currentColor" : "none"} aria-hidden="true" />
          <span>{wishReady && wished ? "في المفضلة" : "إضافة للمفضلة"}</span>
        </button>
      </div>
    </div>
  );
}
