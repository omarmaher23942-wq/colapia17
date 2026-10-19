"use client";

// CheckoutForm — الدفع في صفحة واحدة بالهاتف أولاً، بتوكنات المتجر وحدها (.s-btn/.s-input/.s-chip):
// - بيانات التوصيل: الاسم والموبايل (أرقام عربية و+20 مقبولة) والمحافظة والمنطقة والعنوان وأقرب معلم وموبايل بديل وملاحظات.
// - الأخطاء تظهر في مكانها ويُنتقل إلى أولها؛ الزر لا يُعطَّل بصمت.
// - جهاز عاد: وضع سريع بعنوانه المحفوظ مع «تعديل» و«ليس أنا؟ مسح بياناتي».
// - خيار الهدية، وطرق الدفع (التحويل: اسم صاحب الحساب والتعليمات ونسخ المبلغ بالقروش)، وكود الخصم، وملخص من الخادم.
// - لا بريد إلكتروني للزبائن، وهوية الجهاز من الخادم (لا يُرسل المتصفح معرّفاً).
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Check, Copy, Gift, Loader2, MapPin, RefreshCw, ShieldCheck, ShoppingBag, Truck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/store/cart";
import { GOVERNORATES, governorateName } from "@/lib/egypt";
import { formatEgp } from "@/lib/money";
import { clearPromo, readPromo, savePromo } from "./PromoFromLink";
import { normalizeEgyptianPhone } from "@/lib/phone";
import { placeOrderAction, quoteAction, saveAbandonedAction, type Quote } from "@/server/actions/checkout";
import { MediaUploadButton } from "@/components/storefront/MediaUploadButton";
import { paymentMethods } from "@/lib/payment-methods";
import type { StoreBlueprint } from "@/blueprint/schema";
import { useHydrated } from "./CartView";
import { AREAS, deliveryRange, exactAmount, firstErrorField, validateCheckout, type FieldErrors } from "@/lib/checkout-form";
import { cn } from "@/lib/utils";

type PM = "cod" | "vodafone_cash" | "instapay";
type Form = {
  name: string;
  phone: string;
  altPhone: string;
  governorate: string;
  city: string;
  address: string;
  landmark: string;
  notes: string;
  paymentMethod: PM;
  discountCode: string;
  transferSenderPhone: string;
  transferScreenshotUrl: string;
};
type QuoteOk = Extract<Quote, { ok: true }>;

// 16px على الموبايل حتى لا يكبّر المتصفح الصفحة عند التركيز.
const F =
  "s-input w-full border bg-[var(--background)] px-3.5 py-3 text-base text-[var(--foreground)] outline-none transition-shadow placeholder:opacity-40 focus:ring-2 focus:ring-[var(--primary)]/35 aria-[invalid=true]:border-danger";
const CARD = "space-y-4 rounded-2xl border p-4 sm:p-6";
const SW = 1.75;

function newKey(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

export type CheckoutZone = { code: string; fee: number; etaMin: number; etaMax: number; cod?: number };
export type CheckoutPolicy = {
  flatPiasters: number | null;
  freeOverPiasters: number | null;
  generalEta: string;
  inspectionAllowed: boolean;
  returnDays: number;
  giftEnabled?: boolean;
  giftWrapPiasters?: number;
};

function Field({ id, label, optional, error, hint, children }: { id: string; label: string; optional?: boolean; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px] font-bold">
        <span>{label}</span>
        {optional ? <span className="text-[11px] font-normal opacity-60">اختياري</span> : null}
      </label>
      {children}
      {hint && !error ? <p className="mt-1 text-[11.5px] opacity-65">{hint}</p> : null}
      {error ? (
        <p id={`${id}-err`} role="alert" className="mt-1 text-xs font-bold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          toast.error("تعذّر النسخ، يمكن نسخه يدوياً");
        }
      }}
      className="s-chip inline-flex h-9 shrink-0 items-center gap-1.5 border px-3 text-xs font-bold"
      style={{ borderColor: "var(--border)" }}
      aria-label={label}
    >
      {done ? <Check className="size-3.5" strokeWidth={2.25} aria-hidden="true" /> : <Copy className="size-3.5" strokeWidth={SW} aria-hidden="true" />}
      {done ? "تم النسخ" : "نسخ"}
    </button>
  );
}

export function CheckoutForm({
  subdomain,
  payments,
  remember,
  zones = [],
  policy,
}: {
  subdomain: string;
  payments: StoreBlueprint["payments"];
  remember: boolean;
  zones?: CheckoutZone[];
  policy?: CheckoutPolicy;
}) {
  const zoneByCode = useMemo(() => new Map(zones.map((z) => [z.code, z])), [zones]);
  const governorates = zones.length ? GOVERNORATES.filter((g) => zoneByCode.has(g.code)) : GOVERNORATES;
  const hydrated = useHydrated();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const savedCustomer = useCart((s) => s.customer);
  const rememberCustomer = useCart((s) => s.rememberCustomer);
  const forgetCustomer = useCart((s) => s.forgetCustomer);
  const router = useRouter();
  const methods = useMemo(() => paymentMethods(payments), [payments]);
  const prepaidPct = payments.prepaidDiscountPercent ?? 0;

  const [f, setF] = useState<Form>(() => ({
    name: "",
    phone: "",
    altPhone: "",
    governorate: "",
    city: "",
    address: "",
    landmark: "",
    notes: "",
    paymentMethod: methods[0]?.id ?? "cod",
    discountCode: "",
    transferSenderPhone: "",
    transferScreenshotUrl: "",
  }));
  const [errors, setErrors] = useState<FieldErrors & { discountCode?: string; paymentMethod?: string; form?: string }>({});
  const [editing, setEditing] = useState(false);
  const [gift, setGift] = useState({ on: false, wrap: false, message: "", hidePrices: false });
  const [codeOpen, setCodeOpen] = useState(false);
  const [quote, setQuote] = useState<QuoteOk | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const idemKey = useRef("");
  const quoteSeq = useRef(0);
  const savedPhone = useRef<string | null>(null);
  const prefilled = useRef(false);

  // كود من رابط خصم أو من السلة: يُملأ بعد التركيب (التخزين المحلي لا يُقرأ أثناء العرض على الخادم).
  useEffect(() => {
    const code = readPromo(subdomain);
    if (code) setF((x) => (x.discountCode ? x : { ...x, discountCode: code }));
  }, [subdomain]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((s) => ({ ...s, [k]: v }));
    setErrors((e) => (e[k as keyof typeof e] ? { ...e, [k]: undefined } : e));
  };

  const cartPayload = useMemo(() => items.map((i) => ({ productId: i.productId, variantId: i.variantId, qty: i.qty, bundleId: i.bundleId })), [items]);
  const cartSig = JSON.stringify(cartPayload);
  const phoneNorm = normalizeEgyptianPhone(f.phone) ?? "";
  const giftWrapOn = gift.on && gift.wrap;

  // بيانات الجهاز المحفوظة: تُملأ مرة واحدة، ووضعها السريع يخفي النموذج حتى «تعديل».
  useEffect(() => {
    if (!remember || !savedCustomer || prefilled.current) return;
    prefilled.current = true;
    setF((s) => ({
      ...s,
      name: savedCustomer.name ?? s.name,
      phone: savedCustomer.phone ?? s.phone,
      altPhone: savedCustomer.altPhone ?? s.altPhone,
      governorate: savedCustomer.governorate ?? s.governorate,
      city: savedCustomer.city ?? s.city,
      address: savedCustomer.address ?? s.address,
      landmark: savedCustomer.landmark ?? s.landmark,
    }));
  }, [remember, savedCustomer]);
  const express =
    remember &&
    !editing &&
    Boolean(savedCustomer?.name && savedCustomer.address && savedCustomer.governorate && normalizeEgyptianPhone(savedCustomer.phone ?? "")) &&
    Boolean(f.name && f.address && f.governorate && phoneNorm);

  useEffect(() => {
    idemKey.current = newKey();
    window.clpTrack?.("begin_checkout", { value: items.reduce((a, i) => a + i.unitPiasters * i.qty, 0), items: items.reduce((a, i) => a + i.qty, 0) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // عرض سعر الخادم عند أي تغيير (مؤجَّل قليلاً).
  useEffect(() => {
    if (!cartPayload.length) {
      setQuote(null);
      return;
    }
    const seq = ++quoteSeq.current;
    const t = setTimeout(async () => {
      try {
        const q = await quoteAction(subdomain, {
          items: cartPayload,
          governorate: f.governorate,
          paymentMethod: f.paymentMethod,
          discountCode: f.discountCode || undefined,
          phone: phoneNorm || undefined,
          giftWrap: giftWrapOn,
        });
        if (seq !== quoteSeq.current) return;
        if (q.ok) {
          setQuote(q);
          setQuoteError(null);
        } else {
          setQuote(null);
          setQuoteError(q.error);
        }
      } catch {
        if (seq === quoteSeq.current) setQuoteError(null);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [cartSig, f.governorate, f.paymentMethod, f.discountCode, phoneNorm, subdomain, cartPayload, giftWrapOn]);

  // حفظ السلة المتروكة بعد رقم صالح (الجهاز يُعرف من الخادم).
  useEffect(() => {
    if (!phoneNorm || phoneNorm === savedPhone.current || !cartPayload.length) return;
    const t = setTimeout(() => {
      savedPhone.current = phoneNorm;
      void saveAbandonedAction(subdomain, { phone: phoneNorm, name: f.name || undefined, items: cartPayload });
    }, 1200);
    return () => clearTimeout(t);
  }, [phoneNorm, cartPayload, subdomain, f.name]);

  const eta = useMemo(() => {
    const z = zoneByCode.get(f.governorate);
    return z ? deliveryRange(new Date(), z.etaMin, z.etaMax) : null;
  }, [zoneByCode, f.governorate]);

  if (!hydrated) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]" aria-busy="true">
        <div className="h-96 animate-pulse rounded-2xl bg-[var(--muted)]" />
        <div className="h-64 animate-pulse rounded-2xl bg-[var(--muted)]" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="space-y-4 rounded-2xl border p-10 text-center" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-[var(--muted)] opacity-70">
          <ShoppingBag className="size-8" strokeWidth={SW} aria-hidden="true" />
        </div>
        <p className="text-base font-black">السلة فارغة</p>
        <Link href="/" className="s-btn mx-auto">
          عرض المنتجات
        </Link>
      </div>
    );
  }

  const selected = methods.find((m) => m.id === f.paymentMethod);
  const isTransfer = f.paymentMethod !== "cod";
  const holder = f.paymentMethod === "vodafone_cash" ? payments.vodafoneCash.holderName : f.paymentMethod === "instapay" ? payments.instapay.holderName : undefined;
  const localSub = items.reduce((a, i) => a + i.unitPiasters * i.qty, 0);
  const total = quote?.total ?? null;
  const freeOver = policy?.freeOverPiasters ?? null;
  const giftFee = policy?.giftWrapPiasters ?? 0;

  const goToError = (k: string) => {
    const el = document.getElementById(`co-${k}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    if ("focus" in el) (el as HTMLElement).focus({ preventScroll: true });
  };

  const submit = () =>
    start(async () => {
      const e = validateCheckout(f, { requireProof: payments.requireTransferProof });
      if (Object.keys(e).length) {
        // في الوضع السريع بيانات الشحن مخفية: نفتح التعديل ثم ننتقل للخطأ.
        setEditing(true);
        setErrors(e);
        const first = firstErrorField(e)!;
        toast.error(e[first]!);
        setTimeout(() => goToError(first), 60);
        return;
      }
      setErrors({});
      if (!idemKey.current) idemKey.current = newKey();
      try {
        const r = await placeOrderAction(subdomain, {
          name: f.name,
          phone: f.phone,
          altPhone: f.altPhone || undefined,
          governorate: f.governorate,
          city: f.city || undefined,
          address: f.address,
          landmark: f.landmark || undefined,
          notes: f.notes || undefined,
          paymentMethod: f.paymentMethod,
          discountCode: f.discountCode || undefined,
          transferSenderPhone: isTransfer ? f.transferSenderPhone || f.phone : undefined,
          transferScreenshotUrl: isTransfer ? f.transferScreenshotUrl || undefined : undefined,
          gift: gift.on ? { wrap: gift.wrap, message: gift.message || undefined, hidePrices: gift.hidePrices } : undefined,
          items: cartPayload,
          idempotencyKey: idemKey.current,
        });
        if (!r.ok) {
          const field = r.field && ["name", "phone", "governorate", "address", "discountCode", "paymentMethod"].includes(r.field) ? r.field : "form";
          setErrors({ [field]: r.error } as typeof errors);
          setEditing(true);
          toast.error(r.error);
          setTimeout(() => goToError(field === "form" ? "form-error" : field), 60);
          return;
        }
        if (remember) rememberCustomer({ name: f.name, phone: f.phone, altPhone: f.altPhone, governorate: f.governorate, city: f.city, address: f.address, landmark: f.landmark });
        window.clpTrack?.("purchase", { code: r.data.code, total: r.data.total, productIds: [...new Set(items.map((i) => i.productId))] });
        clear();
        clearPromo(subdomain);
        router.push(`/order/${encodeURIComponent(r.data.code)}`);
      } catch {
        toast.error("تعذّر تأكيد الطلب، يرجى المحاولة مرة أخرى");
      }
    });

  const err = (k: keyof typeof errors) => errors[k];
  const bind = (k: keyof Form & keyof typeof errors) => ({
    id: `co-${k}`,
    "aria-invalid": err(k) ? true : undefined,
    "aria-describedby": err(k) ? `co-${k}-err` : undefined,
  });

  const summary = (
    <aside id="order-summary" className="h-fit space-y-3 rounded-2xl border p-4 sm:p-5 lg:sticky lg:top-24" style={{ background: "var(--card)", borderColor: "var(--border)" }} aria-label="ملخص الطلب">
      <h2 className="flex items-center gap-2 font-heading text-base font-black">
        <ShoppingBag className="size-4" strokeWidth={SW} style={{ color: "var(--primary)" }} aria-hidden="true" /> ملخص الطلب
      </h2>
      <ul className="max-h-64 divide-y overflow-y-auto" style={{ borderColor: "var(--border)" }}>
        {(quote?.lines ?? items.map((i) => ({ key: `${i.productId}:${i.variantId ?? ""}`, name: i.name, qty: i.qty, net: i.unitPiasters * i.qty, lineOff: 0, isGift: false } as const))).map((l) => {
          const it = items.find((i) => i.productId === l.key.split(":")[0] && (i.variantId ?? "") === (l.key.split(":")[1] ?? ""));
          return (
            <li key={l.key} className="flex items-center gap-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
              <span className="relative size-12 shrink-0 overflow-hidden rounded-lg" style={{ background: "var(--muted)" }}>
                {it?.imageUrl ? <Image src={it.imageUrl} alt="" fill sizes="48px" className="object-cover" /> : null}
                <span className="absolute -top-0 end-0 grid min-w-5 place-items-center rounded-es-lg px-1 text-[10px] font-bold" style={{ background: "var(--foreground)", color: "var(--background)" }}>{l.qty}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 font-bold leading-snug">{l.name}</span>
                {it?.variantLabel ? <span className="block text-[11px] opacity-65">{it.variantLabel}</span> : null}
              </span>
              <span className="shrink-0 font-mono text-xs font-bold tabular-nums">{l.isGift ? "مجاناً" : formatEgp(l.net)}</span>
            </li>
          );
        })}
      </ul>
      <dl className="space-y-1.5 border-t pt-3 text-sm" style={{ borderColor: "var(--border)" }}>
        <div className="flex justify-between"><dt className="opacity-70">المجموع</dt><dd className="font-mono tabular-nums">{formatEgp(quote?.subtotal ?? localSub)}</dd></div>
        {quote?.adjustments.map((a, i) => (
          <div key={i} className="flex justify-between gap-3 text-success"><dt>{a.label}</dt><dd className="font-mono tabular-nums">- {formatEgp(a.amount)}</dd></div>
        ))}
        <div className="flex justify-between">
          <dt className="opacity-70">الشحن{f.governorate ? ` إلى ${governorateName(f.governorate)}` : ""}</dt>
          <dd className="font-mono tabular-nums">{quote?.shipping == null ? "اختاروا المحافظة" : quote.shipping === 0 ? "مجاني" : formatEgp(quote.shipping)}</dd>
        </div>
        {quote && quote.codFee > 0 ? <div className="flex justify-between"><dt className="opacity-70">رسوم الدفع عند الاستلام</dt><dd className="font-mono tabular-nums">{formatEgp(quote.codFee)}</dd></div> : null}
        {quote && quote.giftWrap > 0 ? <div className="flex justify-between"><dt className="opacity-70">تغليف هدية</dt><dd className="font-mono tabular-nums">{formatEgp(quote.giftWrap)}</dd></div> : null}
        <div className="flex items-baseline justify-between border-t pt-2.5 text-base font-black" style={{ borderColor: "var(--border)" }}>
          <dt>الإجمالي</dt>
          <dd className="font-mono text-lg tabular-nums">{total !== null ? formatEgp(total) : `${formatEgp(quote?.afterDiscount ?? localSub)} + الشحن`}</dd>
        </div>
      </dl>
      {freeOver ? (
        <p className="flex items-start gap-1.5 text-[11.5px] leading-5 opacity-80">
          <Truck className="mt-0.5 size-3.5 shrink-0" strokeWidth={SW} aria-hidden="true" />
          {quote?.freeShipping ? "الشحن مجاني على هذا الطلب." : `الشحن مجاني للطلبات من ${formatEgp(freeOver)} فأكثر، ويُحتسب على المجموع بعد الخصم.`}
        </p>
      ) : null}
      {quoteError ? <p role="alert" className="text-xs font-bold text-danger">{quoteError}</p> : null}
      {quote?.shippingError ? <p role="alert" className="text-xs font-bold text-danger">{quote.shippingError}</p> : null}
      <button type="submit" form="checkout-form" disabled={pending} className="s-btn hidden h-12 w-full text-sm lg:inline-flex">
        {pending ? <Loader2 className="size-5 animate-spin" strokeWidth={SW} aria-hidden="true" /> : <ShieldCheck className="size-5" strokeWidth={SW} aria-hidden="true" />}
        {pending ? "جارٍ تأكيد الطلب" : "تأكيد الطلب"}
      </button>
      <p className="text-center text-[11px] opacity-60">بالضغط على «تأكيد الطلب» تؤكدون صحة البيانات.{policy?.returnDays ? ` الاستبدال والاسترجاع خلال ${policy.returnDays} يوماً.` : ""}</p>
    </aside>
  );

  return (
    <div className="grid gap-6 pb-24 lg:grid-cols-[1fr_380px] lg:pb-0" dir="rtl">
      <form id="checkout-form" className="space-y-5" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
        {errors.form ? <p id="co-form-error" tabIndex={-1} role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm font-bold text-danger">{errors.form}</p> : null}

        {/* التوصيل */}
        <section className={CARD} style={{ background: "var(--card)", borderColor: "var(--border)" }} aria-labelledby="co-h-ship">
          <header className="flex items-center justify-between gap-2">
            <h2 id="co-h-ship" className="flex items-center gap-2 font-heading text-base font-black">
              <UserRound className="size-4" strokeWidth={SW} style={{ color: "var(--primary)" }} aria-hidden="true" /> بيانات التوصيل
            </h2>
            {policy?.inspectionAllowed ? (
              <span className="s-chip inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold" style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }}>
                <ShieldCheck className="size-3.5" strokeWidth={SW} aria-hidden="true" /> المعاينة متاحة قبل الدفع
              </span>
            ) : null}
          </header>

          {express ? (
            <div className="flex items-start gap-3 rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--muted) 55%, transparent)" }}>
              <MapPin className="mt-0.5 size-5 shrink-0" strokeWidth={SW} style={{ color: "var(--primary)" }} aria-hidden="true" />
              <div className="min-w-0 flex-1 text-sm leading-6">
                <p className="font-black">{f.name} · <span dir="ltr" className="font-mono">{phoneNorm}</span></p>
                <p className="opacity-80">{[governorateName(f.governorate), f.city, f.address].filter(Boolean).join("، ")}</p>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold">
                  <button type="button" onClick={() => setEditing(true)} className="underline underline-offset-4">تعديل</button>
                  <button
                    type="button"
                    onClick={() => {
                      forgetCustomer();
                      prefilled.current = true;
                      setF((s) => ({ ...s, name: "", phone: "", altPhone: "", governorate: "", city: "", address: "", landmark: "" }));
                      setEditing(true);
                    }}
                    className="underline underline-offset-4 opacity-75"
                  >
                    ليس أنا؟ مسح بياناتي
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="co-name" label="الاسم بالكامل" error={err("name")}>
                <input {...bind("name")} className={F} placeholder="الاسم الثلاثي" autoComplete="name" value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={60} />
              </Field>
              <Field id="co-phone" label="رقم الموبايل" error={err("phone")}>
                <input {...bind("phone")} className={F} dir="ltr" inputMode="tel" autoComplete="tel" placeholder="01012345678" value={f.phone} onChange={(e) => set("phone", e.target.value)} maxLength={20} />
              </Field>
              <Field id="co-governorate" label="المحافظة" error={err("governorate")}>
                <select {...bind("governorate")} className={F} autoComplete="address-level1" value={f.governorate} onChange={(e) => { set("governorate", e.target.value); set("city", ""); }}>
                  <option value="">اختاروا المحافظة</option>
                  {governorates.map((g) => (
                    <option key={g.code} value={g.code}>{g.name}</option>
                  ))}
                </select>
              </Field>
              <Field id="co-city" label="المنطقة أو المدينة" optional>
                <input id="co-city" className={F} list="co-areas" autoComplete="address-level2" placeholder="مثال: مدينة نصر" value={f.city} onChange={(e) => set("city", e.target.value)} maxLength={60} />
                <datalist id="co-areas">{(AREAS[f.governorate] ?? []).map((a) => <option key={a} value={a} />)}</datalist>
              </Field>
              <div className="sm:col-span-2">
                <Field id="co-address" label="العنوان بالتفصيل" error={err("address")} hint="اسم الشارع ورقم العمارة والدور والشقة">
                  <textarea {...bind("address")} className={cn(F, "min-h-[84px] resize-y")} autoComplete="street-address" value={f.address} onChange={(e) => set("address", e.target.value)} maxLength={300} />
                </Field>
              </div>
              <Field id="co-landmark" label="أقرب معلم" optional>
                <input id="co-landmark" className={F} placeholder="بجوار مسجد أو صيدلية…" value={f.landmark} onChange={(e) => set("landmark", e.target.value)} maxLength={120} />
              </Field>
              <Field id="co-altPhone" label="موبايل بديل" optional error={err("altPhone")}>
                <input {...bind("altPhone")} className={F} dir="ltr" inputMode="tel" placeholder="01xxxxxxxxx" value={f.altPhone} onChange={(e) => set("altPhone", e.target.value)} maxLength={20} />
              </Field>
            </div>
          )}

          <Field id="co-notes" label="ملاحظات للمتجر أو المندوب" optional>
            <textarea id="co-notes" className={cn(F, "min-h-[64px] resize-y")} placeholder="مواعيد مناسبة للتوصيل أو أي تفاصيل أخرى" value={f.notes} onChange={(e) => set("notes", e.target.value)} maxLength={300} />
          </Field>

          {f.governorate ? (
            <p className="flex items-start gap-2 text-[12.5px] leading-6" style={{ color: "var(--primary)" }}>
              <Truck className="mt-1 size-4 shrink-0" strokeWidth={SW} aria-hidden="true" />
              <span>{eta ? `موعد التوصيل المتوقع: ${eta}` : policy?.generalEta ? `مدة التوصيل: ${policy.generalEta}` : null}</span>
            </p>
          ) : null}
        </section>

        {/* الهدية */}
        {policy?.giftEnabled ? (
          <section className={CARD} style={{ background: "var(--card)", borderColor: "var(--border)" }} aria-labelledby="co-h-gift">
            <label className="flex cursor-pointer items-center gap-3">
              <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={gift.on} onChange={(e) => setGift((g) => ({ ...g, on: e.target.checked }))} />
              <span id="co-h-gift" className="flex items-center gap-2 text-sm font-black">
                <Gift className="size-4" strokeWidth={SW} style={{ color: "var(--primary)" }} aria-hidden="true" /> هذا الطلب هدية
              </span>
            </label>
            {gift.on ? (
              <div className="space-y-3">
                {giftFee > 0 ? (
                  <label className="flex cursor-pointer items-center gap-3 text-sm">
                    <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={gift.wrap} onChange={(e) => setGift((g) => ({ ...g, wrap: e.target.checked }))} />
                    <span>تغليف هدية (+ {formatEgp(giftFee)})</span>
                  </label>
                ) : (
                  <label className="flex cursor-pointer items-center gap-3 text-sm">
                    <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={gift.wrap} onChange={(e) => setGift((g) => ({ ...g, wrap: e.target.checked }))} />
                    <span>تغليف هدية بلا رسوم</span>
                  </label>
                )}
                <label className="flex cursor-pointer items-center gap-3 text-sm">
                  <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={gift.hidePrices} onChange={(e) => setGift((g) => ({ ...g, hidePrices: e.target.checked }))} />
                  <span>إخفاء الأسعار من الفاتورة</span>
                </label>
                <Field id="co-giftmsg" label="رسالة الهدية" optional>
                  <textarea id="co-giftmsg" className={cn(F, "min-h-[64px] resize-y")} maxLength={200} value={gift.message} onChange={(e) => setGift((g) => ({ ...g, message: e.target.value }))} />
                </Field>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* الدفع */}
        <section className={CARD} style={{ background: "var(--card)", borderColor: "var(--border)" }} aria-labelledby="co-h-pay">
          <h2 id="co-h-pay" className="font-heading text-base font-black">طريقة الدفع</h2>
          <div role="radiogroup" aria-labelledby="co-h-pay" className="grid gap-3">
            {methods.map((m) => {
              const on = f.paymentMethod === m.id;
              return (
                <label
                  key={m.id}
                  className={cn("flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3.5 transition-colors", on && "shadow-sm")}
                  style={{ borderColor: on ? "var(--primary)" : "var(--border)", background: on ? "color-mix(in srgb, var(--primary) 7%, transparent)" : undefined }}
                >
                  <input type="radio" name="payment" className="mt-1 size-5 accent-[var(--primary)]" checked={on} onChange={() => set("paymentMethod", m.id)} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-black">
                      {m.label}
                      {m.id !== "cod" && prepaidPct > 0 ? <span className="s-chip px-2 py-0.5 text-[11px] font-bold" style={{ background: "color-mix(in srgb, var(--primary) 14%, transparent)", color: "var(--primary)" }}>خصم {prepaidPct}%</span> : null}
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 opacity-75">{m.id === "cod" ? "الدفع كاشاً للمندوب عند الاستلام" : "تحويل قبل الشحن لتأكيد أسرع"}</span>
                  </span>
                </label>
              );
            })}
          </div>

          {isTransfer ? (
            <div className="space-y-3 rounded-xl border p-3.5" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--muted) 45%, transparent)" }}>
              {selected?.targetNumber ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 text-sm">
                    <p className="text-xs opacity-70">{f.paymentMethod === "vodafone_cash" ? "رقم المحفظة" : "عنوان إنستاباي أو الرقم"}</p>
                    <p dir="ltr" className="select-all break-all text-end font-mono text-base font-black">{selected.targetNumber}</p>
                    {holder ? <p className="text-xs opacity-75">باسم: <b>{holder}</b></p> : null}
                  </div>
                  <CopyButton text={selected.targetNumber} label="نسخ رقم التحويل" />
                </div>
              ) : (
                <p className="text-sm font-bold">تواصلوا مع المتجر للحصول على بيانات التحويل قبل إتمام الدفع.</p>
              )}
              {payments.transferInstructions ? <p className="text-xs leading-6 opacity-80">{payments.transferInstructions}</p> : null}
              <div className="flex items-center justify-between gap-3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
                <div className="text-sm">
                  <p className="text-xs opacity-70">المبلغ المطلوب تحويله بالضبط</p>
                  {total !== null ? <p dir="ltr" className="text-end font-mono text-lg font-black tabular-nums">{exactAmount(total)} <span className="text-xs font-bold">ج.م</span></p> : <p className="text-xs font-bold">اختاروا المحافظة ليظهر المبلغ بعد الشحن</p>}
                </div>
                {total !== null ? <CopyButton text={exactAmount(total)} label="نسخ المبلغ" /> : null}
              </div>
              <Field id="co-transferScreenshotUrl" label="صورة إيصال التحويل" error={err("transferScreenshotUrl")}>
                <div id="co-transferScreenshotUrl" tabIndex={-1} className="outline-none">
                {f.transferScreenshotUrl ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.transferScreenshotUrl} alt="إيصال التحويل" className="h-20 rounded-lg border" style={{ borderColor: "var(--border)" }} />
                    <button type="button" onClick={() => set("transferScreenshotUrl", "")} className="inline-flex items-center gap-1.5 text-xs font-bold opacity-75 hover:opacity-100">
                      <RefreshCw className="size-3.5" strokeWidth={SW} aria-hidden="true" /> تغيير الصورة
                    </button>
                  </div>
                ) : (
                  <MediaUploadButton route="transferProof" input={{ subdomain }} label="رفع صورة التحويل" onUploaded={(u) => set("transferScreenshotUrl", u)} onError={(m) => toast.error(m)} />
                )}
                </div>
              </Field>
              <Field id="co-transferSenderPhone" label="الرقم الذي حُوّل منه" optional>
                <input id="co-transferSenderPhone" className={F} dir="ltr" inputMode="tel" placeholder={f.phone || "01xxxxxxxxx"} value={f.transferSenderPhone} onChange={(e) => set("transferSenderPhone", e.target.value)} maxLength={20} />
              </Field>
            </div>
          ) : null}
          {err("paymentMethod") ? <p role="alert" className="text-xs font-bold text-danger">{err("paymentMethod")}</p> : null}

          {/* كود الخصم */}
          {codeOpen || f.discountCode ? (
            <Field id="co-discountCode" label="كود الخصم" error={err("discountCode") ?? quote?.discountError}>
              <input
                {...bind("discountCode")}
                className={cn(F, "uppercase")}
                dir="ltr"
                maxLength={20}
                value={f.discountCode}
                onChange={(e) => { set("discountCode", e.target.value.trim().toUpperCase()); if (!e.target.value) clearPromo(subdomain); else savePromo(subdomain, e.target.value); }}
              />
            </Field>
          ) : (
            <button type="button" onClick={() => setCodeOpen(true)} className="text-sm font-bold underline underline-offset-4 opacity-80 hover:opacity-100">
              لديكم كود خصم؟
            </button>
          )}
        </section>

      </form>

      {summary}

      {/* شريط الإجمالي والتأكيد الثابت على الموبايل */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t px-4 py-3 backdrop-blur-xl lg:hidden" style={{ background: "color-mix(in srgb, var(--background) 92%, transparent)", borderColor: "var(--border)" }}>
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-[11px] opacity-70">الإجمالي</p>
            <p className="font-mono text-base font-black tabular-nums">{total !== null ? formatEgp(total) : `${formatEgp(quote?.afterDiscount ?? localSub)}+`}</p>
          </div>
          <button type="submit" form="checkout-form" disabled={pending} className="s-btn h-12 flex-[1.4] text-sm">
            {pending ? <Loader2 className="size-5 animate-spin" strokeWidth={SW} aria-hidden="true" /> : <ShieldCheck className="size-5" strokeWidth={SW} aria-hidden="true" />}
            {pending ? "جارٍ التأكيد" : "تأكيد الطلب"}
          </button>
        </div>
      </div>
    </div>
  );
}
