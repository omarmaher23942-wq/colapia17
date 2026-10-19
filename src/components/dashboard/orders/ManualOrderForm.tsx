"use client";

// ManualOrderForm — «طلب من الشات»: لصق رسالة العميل يملأ بياناته، والرقم يتعرّف على العميل السابق وسجله، واختيار
// المنتجات بتركيباتها ومخزونها الحالي مع سعر خاص اختياري، والشحن من جدول المتجر أو يدوياً، ثم الحفظ وفتح الطلب.
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardPaste, Minus, Plus, Search, Trash2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatEgp } from "@/lib/money";
import { fmtNum } from "@/lib/format";
import { GOVERNORATES } from "@/lib/egypt";
import { normalizeEgyptianPhone } from "@/lib/phone";
import { CHAT_SOURCES, CHAT_SOURCE_LABEL, parseChatDetails, type ChatSource } from "@/lib/manual-order";
import { createManualOrderAction, lookupCustomerAction, manualShippingQuoteAction, type KnownCustomer } from "@/server/actions/manual-order";
import type { PickProduct } from "@/server/repos/manual-order";
import { inputCls, Section } from "@/components/dashboard/product/parts";
import { toNumber } from "@/components/dashboard/product/model";

type Line = { key: string; productId: string; variantId?: string; name: string; label: string | null; image: string | null; qty: number; price: number; special: string; max: number | null };
type Pay = "cod" | "vodafone_cash" | "instapay";
const PAY_LABEL: Record<Pay, string> = { cod: "عند الاستلام", vodafone_cash: "فودافون كاش", instapay: "إنستاباي" };

const SHOWN = new Set(["phone", "name", "governorate", "address", "items", "shipping"]);

const pounds = (s: string) => {
  const n = toNumber(s);
  return n === null || n < 0 ? null : Math.round(n * 100);
};

export function ManualOrderForm({ catalog }: { catalog: PickProduct[] }) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [source, setSource] = useState<ChatSource>("instagram");
  const [paste, setPaste] = useState("");
  const [f, setF] = useState({ name: "", phone: "", altPhone: "", governorate: "", city: "", address: "", landmark: "", notes: "" });
  const [known, setKnown] = useState<KnownCustomer | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [q, setQ] = useState("");
  const [picking, setPicking] = useState<PickProduct | null>(null);
  const [pay, setPay] = useState<Pay>("cod");
  const [paid, setPaid] = useState(false);
  const [confirmed, setConfirmed] = useState(true);
  const [shipManual, setShipManual] = useState(false);
  const [shipText, setShipText] = useState("");
  const [discountText, setDiscountText] = useState("");
  const [quote, setQuote] = useState<{ fee: number; codExtra: number } | { error: string } | null>(null);
  const [error, setError] = useState<{ msg: string; field?: string } | null>(null);
  const lookedUp = useRef("");

  const set = (k: keyof typeof f, v: string) => setF((cur) => ({ ...cur, [k]: v }));

  const subtotal = lines.reduce((a, l) => a + (pounds(l.special) ?? l.price) * l.qty, 0);
  const discount = Math.min(pounds(discountText) ?? 0, subtotal);
  const shipping = shipManual ? (pounds(shipText) ?? 0) : quote && "fee" in quote ? quote.fee + quote.codExtra : null;
  const total = subtotal - discount + (shipping ?? 0);

  // العميل السابق بنفس الرقم: يملأ الفارغ فقط ويعرض سجله.
  useEffect(() => {
    const p = normalizeEgyptianPhone(f.phone);
    if (!p || lookedUp.current === p) return;
    lookedUp.current = p;
    void lookupCustomerAction(p).then((c) => {
      setKnown(c);
      if (c)
        setF((cur) => ({
          ...cur,
          name: cur.name || c.name,
          governorate: cur.governorate || c.governorate || "",
          city: cur.city || c.city || "",
          address: cur.address || c.address || "",
          altPhone: cur.altPhone || c.altPhone || "",
        }));
    });
  }, [f.phone]);

  // الشحن كما يحسبه المتجر لهذه المحافظة والمبلغ وطريقة الدفع.
  useEffect(() => {
    if (shipManual || !f.governorate) return setQuote(null);
    let live = true;
    const t = setTimeout(() => {
      void manualShippingQuoteAction(f.governorate, subtotal, pay).then((r) => {
        if (!live) return;
        setQuote(r.ok ? r.data : { error: r.error });
        if (!r.ok && r.field === "shipping") setShipManual(true);
      });
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [f.governorate, subtotal, pay, shipManual]);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (t ? catalog.filter((p) => p.name.toLowerCase().includes(t)) : catalog).slice(0, 8);
  }, [q, catalog]);

  const extract = () => {
    const d = parseChatDetails(paste);
    const found = [d.phone, d.name, d.governorate, d.address].filter(Boolean).length;
    if (!found) return void toast.error("لم نجد رقماً أو اسماً أو عنواناً واضحاً في الرسالة. اكتب البيانات بنفسك.");
    setF((cur) => ({
      ...cur,
      phone: d.phone ?? cur.phone,
      altPhone: d.altPhone ?? cur.altPhone,
      name: d.name ?? cur.name,
      governorate: d.governorate ?? cur.governorate,
      address: d.address ?? cur.address,
    }));
    toast.success("تم ملء البيانات من الرسالة. راجعها قبل الحفظ.");
  };

  const add = (p: PickProduct, v?: PickProduct["variants"][number]) => {
    const key = `${p.id}:${v?.id ?? ""}`;
    const max = p.trackStock ? (v ? v.stock : p.stock) : null;
    setLines((all) => {
      const ex = all.find((l) => l.key === key);
      if (ex) return all.map((l) => (l.key === key ? { ...l, qty: Math.min(50, max ?? 50, l.qty + 1) } : l));
      return [...all, { key, productId: p.id, variantId: v?.id, name: p.name, label: v?.label ?? null, image: p.image, qty: 1, price: v?.price ?? p.price, special: "", max }];
    });
    setPicking(null);
    setQ("");
  };

  const save = () => {
    setError(null);
    if (!lines.length) return setError({ msg: "المطلوب منتج واحد على الأقل", field: "items" });
    const ship = shipManual ? pounds(shipText) : undefined;
    if (shipManual && ship === null) return setError({ msg: "اكتب سعر الشحن (0 للشحن المجاني)", field: "shipping" });
    startSave(async () => {
      const r = await createManualOrderAction({
        source,
        ...f,
        altPhone: f.altPhone || undefined,
        city: f.city || undefined,
        landmark: f.landmark || undefined,
        notes: f.notes || undefined,
        paymentMethod: pay,
        paid: pay !== "cod" && paid,
        confirmed,
        items: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, qty: l.qty, unitPiasters: pounds(l.special) ?? undefined })),
        shippingPiasters: ship ?? undefined,
        discountPiasters: discount,
      });
      if (!r.ok) {
        setError({ msg: r.error, field: r.field });
        document.querySelector(`[data-field="${r.field}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      toast.success(`تم حفظ الطلب ${r.data.code}`);
      router.push(`/dashboard/orders/${r.data.id}?created=1`);
    });
  };

  const err = (field: string) => (error?.field === field ? error.msg : null);

  return (
    <div className="space-y-4">
      <Section title="من أين جاء الطلب؟">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="مصدر الطلب">
          {CHAT_SOURCES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={source === s}
              onClick={() => setSource(s)}
              className={cn("min-h-10 rounded-xl border px-3.5 text-[12.5px] font-bold transition", source === s ? "border-nova bg-nova/15 text-ink" : "border-edge/10 text-ink-3 hover:text-ink")}
            >
              {CHAT_SOURCE_LABEL[s]}
            </button>
          ))}
        </div>
      </Section>

      <Section title="بيانات العميل" hint="الصق رسالة العميل كما هي (الاسم والرقم والعنوان) وسنملأ الحقول، ثم راجعها.">
        <div className="space-y-2">
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={3} placeholder={"مثال:\nمنى أحمد 01012345678\n12 شارع التحرير، الدقي، الجيزة"} className={cn(inputCls, "min-h-20 py-2.5 font-normal")} aria-label="رسالة العميل" />
          <button type="button" onClick={extract} disabled={!paste.trim()} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-edge/[0.06] px-3.5 text-[12.5px] font-black text-ink disabled:opacity-40">
            <ClipboardPaste className="size-4" aria-hidden="true" /> ملء البيانات من الرسالة
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled label="رقم الموبايل" error={err("phone")} field="phone">
            <input value={f.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" dir="ltr" placeholder="01xxxxxxxxx" className={inputCls} aria-invalid={Boolean(err("phone"))} />
          </Labeled>
          <Labeled label="الاسم" error={err("name")} field="name">
            <input value={f.name} onChange={(e) => set("name", e.target.value)} className={inputCls} aria-invalid={Boolean(err("name"))} />
          </Labeled>
          {known ? (
            <p className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-bold sm:col-span-2", known.returned > 0 || known.isBlocked ? "bg-bad/10 text-bad" : "bg-ok/10 text-ok")}>
              <UserCheck className="size-4 shrink-0" aria-hidden="true" />
              عميل سابق: استلم {fmtNum(known.delivered)} {known.returned ? `· رفض الاستلام ${fmtNum(known.returned)}` : ""}
              {known.isBlocked ? " · محظور في متجرك" : ""}
            </p>
          ) : null}
          <Labeled label="المحافظة" error={err("governorate")} field="governorate">
            <select value={f.governorate} onChange={(e) => set("governorate", e.target.value)} className={inputCls} aria-invalid={Boolean(err("governorate"))}>
              <option value="">اختيار المحافظة</option>
              {GOVERNORATES.map((g) => (
                <option key={g.code} value={g.code}>{g.name}</option>
              ))}
            </select>
          </Labeled>
          <Labeled label="المنطقة أو المدينة (اختياري)">
            <input value={f.city} onChange={(e) => set("city", e.target.value)} className={inputCls} />
          </Labeled>
          <div className="sm:col-span-2">
            <Labeled label="العنوان بالتفصيل" error={err("address")} field="address">
              <input value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="الشارع، رقم العمارة، الدور والشقة" className={inputCls} aria-invalid={Boolean(err("address"))} />
            </Labeled>
          </div>
          <Labeled label="علامة مميزة (اختياري)">
            <input value={f.landmark} onChange={(e) => set("landmark", e.target.value)} className={inputCls} />
          </Labeled>
          <Labeled label="رقم آخر (اختياري)">
            <input value={f.altPhone} onChange={(e) => set("altPhone", e.target.value)} inputMode="tel" dir="ltr" className={inputCls} />
          </Labeled>
        </div>
      </Section>

      <Section title="المنتجات" hint="الأسعار والمخزون الحاليان من متجرك. السعر الخاص اختياري لو اتفقتم على سعر مختلف في المحادثة.">
        <div data-field="items" className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
            <input value={q} onChange={(e) => (setQ(e.target.value), setPicking(null))} placeholder="البحث عن منتج بالاسم" className={cn(inputCls, "ps-9")} aria-label="البحث عن منتج" />
          </div>
          {picking ? (
            <div className="rounded-xl border border-nova/30 p-3">
              <p className="text-[12.5px] font-black text-ink">{picking.name}: اختيار {picking.optionNames.join(" و") || "الخيار"}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {picking.variants.map((v) => {
                  const out = !v.available || (picking.trackStock && v.stock !== null && v.stock <= 0);
                  return (
                    <button key={v.id} type="button" disabled={out} onClick={() => add(picking, v)} className={cn("min-h-10 rounded-xl border px-3 text-[12px] font-bold", out ? "border-edge/10 text-ink-3 line-through opacity-50" : "border-edge/15 text-ink hover:border-nova")}>
                      {v.label}
                      {picking.trackStock && v.stock !== null && v.stock > 0 ? <span className="ms-1 text-[10.5px] text-ink-3">({fmtNum(v.stock)})</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : q || !lines.length ? (
            <ul className="divide-y divide-edge/10 rounded-xl border border-edge/10">
              {results.length ? (
                results.map((p) => {
                  const out = p.trackStock && p.stock !== null && p.stock <= 0;
                  return (
                    <li key={p.id}>
                      <button type="button" disabled={out} onClick={() => (p.variants.length && p.optionNames.length ? setPicking(p) : add(p))} className="flex w-full items-center gap-3 p-2.5 text-start disabled:opacity-50">
                        {/* eslint-disable-next-line @next/next/no-img-element -- صورة مصغّرة من مضيف المتجر */}
                        {p.image ? <img src={p.image} alt="" className="size-10 shrink-0 rounded-lg object-cover" /> : <span className="size-10 shrink-0 rounded-lg bg-edge/[0.06]" />}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-bold text-ink">{p.name}</span>
                          <span className="text-[11.5px] text-ink-3">{formatEgp(p.price)}{out ? " · نفد" : p.trackStock && p.stock !== null ? ` · متاح ${fmtNum(p.stock)}` : ""}</span>
                        </span>
                        <Plus className="size-4 text-ink-3" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })
              ) : (
                <li className="p-3 text-[12.5px] text-ink-3">لا منتج منشور بهذا الاسم.</li>
              )}
            </ul>
          ) : null}

          {lines.length ? (
            <ul className="space-y-2">
              {lines.map((l) => (
                <li key={l.key} className="flex flex-wrap items-center gap-2.5 rounded-xl bg-edge/[0.03] p-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element -- صورة مصغّرة من مضيف المتجر */}
                  {l.image ? <img src={l.image} alt="" className="size-11 shrink-0 rounded-lg object-cover" /> : null}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-ink">{l.name}</p>
                    <p className="text-[11.5px] text-ink-3">{l.label ? `${l.label} · ` : ""}{formatEgp(l.price)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" aria-label="إنقاص" onClick={() => setLines((all) => all.map((x) => (x.key === l.key ? { ...x, qty: Math.max(1, x.qty - 1) } : x)))} className="grid size-9 place-items-center rounded-lg bg-edge/[0.06]">
                      <Minus className="size-3.5" aria-hidden="true" />
                    </button>
                    <span className="w-7 text-center text-[13px] font-black tabular-nums">{l.qty}</span>
                    <button type="button" aria-label="زيادة" disabled={l.max !== null && l.qty >= l.max} onClick={() => setLines((all) => all.map((x) => (x.key === l.key ? { ...x, qty: Math.min(50, x.qty + 1) } : x)))} className="grid size-9 place-items-center rounded-lg bg-edge/[0.06] disabled:opacity-40">
                      <Plus className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  <input value={l.special} onChange={(e) => setLines((all) => all.map((x) => (x.key === l.key ? { ...x, special: e.target.value } : x)))} inputMode="decimal" placeholder="سعر خاص" aria-label={`سعر خاص للقطعة من ${l.name}`} className={cn(inputCls, "min-h-9 w-24 px-2 text-[12px]")} />
                  <button type="button" aria-label={`حذف ${l.name}`} onClick={() => setLines((all) => all.filter((x) => x.key !== l.key))} className="grid size-9 place-items-center rounded-lg text-ink-3 hover:text-bad">
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {err("items") ? <p className="text-[12px] font-bold text-bad">{err("items")}</p> : null}
        </div>
      </Section>

      <Section title="الدفع والشحن">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="طريقة الدفع">
          {(Object.keys(PAY_LABEL) as Pay[]).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={pay === m} onClick={() => setPay(m)} className={cn("min-h-10 rounded-xl border px-3.5 text-[12.5px] font-bold", pay === m ? "border-nova bg-nova/15 text-ink" : "border-edge/10 text-ink-3")}>
              {PAY_LABEL[m]}
            </button>
          ))}
        </div>
        {pay !== "cod" ? (
          <label className="flex items-center gap-2 text-[12.5px] font-bold text-ink-2">
            <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="size-4 accent-[var(--dash-nova)]" /> وصل التحويل بالفعل
          </label>
        ) : null}
        <div data-field="shipping" className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-[12px] font-bold text-ink-2">الشحن</p>
            {shipManual ? (
              <input value={shipText} onChange={(e) => setShipText(e.target.value)} inputMode="decimal" placeholder="سعر الشحن بالجنيه" className={inputCls} aria-invalid={Boolean(err("shipping"))} />
            ) : (
              <p className="flex min-h-11 items-center text-[13px] font-black text-ink">
                {!f.governorate ? <span className="text-[12px] font-bold text-ink-3">يظهر بعد اختيار المحافظة</span> : quote && "fee" in quote ? formatEgp(quote.fee + quote.codExtra) : quote ? <span className="text-[12px] text-bad">{quote.error}</span> : "…"}
              </p>
            )}
            <button type="button" onClick={() => setShipManual((v) => !v)} className="text-[11.5px] font-bold text-nova-2 underline-offset-4 hover:underline">
              {shipManual ? "حساب الشحن من جدول متجري" : "كتابة سعر شحن مختلف"}
            </button>
            {err("shipping") ? <p className="text-[12px] font-bold text-bad">{err("shipping")}</p> : null}
          </div>
          <Labeled label="خصم بالجنيه (اختياري)">
            <input value={discountText} onChange={(e) => setDiscountText(e.target.value)} inputMode="decimal" placeholder="0" className={inputCls} />
          </Labeled>
        </div>
        <Labeled label="ملاحظة على الطلب (اختياري)">
          <input value={f.notes} onChange={(e) => set("notes", e.target.value)} className={inputCls} />
        </Labeled>
        <label className="flex items-start gap-2 text-[12.5px] font-bold text-ink-2">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 size-4 accent-[var(--dash-nova)]" />
          <span>
            العميل أكّد الطلب في المحادثة
            <span className="block text-[11.5px] font-normal text-ink-3">بدونه يبدأ الطلب «جديداً» ومعه رسالة تأكيد برابط يرسلها له.</span>
          </span>
        </label>
      </Section>

      <div data-savebar className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 lg:bottom-4">
        <div className="dash-card flex items-center justify-between gap-3 border-nova/30 p-2.5 ps-4 shadow-2xl shadow-black/20">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-ink-3">{discount ? `خصم ${formatEgp(discount)} · ` : ""}{shipping === null ? "قبل الشحن" : `شامل الشحن`}</p>
            <p className="text-[16px] font-black tabular-nums text-ink">{formatEgp(total)}</p>
            {error && !SHOWN.has(error.field ?? "") ? <p className="text-[11.5px] font-bold text-bad">{error.msg}</p> : null}
          </div>
          <button type="button" onClick={save} disabled={saving} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-5 text-[13px] font-black text-white shadow-md disabled:opacity-60">
            {saving ? "نحفظ…" : "حفظ الطلب"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Labeled({ label, error, field, children }: { label: string; error?: string | null; field?: string; children: React.ReactNode }) {
  return (
    <label data-field={field} className="block space-y-1.5">
      <span className="text-[12px] font-bold text-ink-2">{label}</span>
      {children}
      {error ? <span className="block text-[12px] font-bold text-bad">{error}</span> : null}
    </label>
  );
}
