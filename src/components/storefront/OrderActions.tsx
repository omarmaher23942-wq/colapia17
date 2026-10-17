"use client";

// OrderActions — ما يفعله العميل بعد الشراء بلا حساب: إعادة الطلب بالأسعار الحالية، طلب إلغاء، طلب استبدال/استرجاع بصور،
// ونسخ «رابط طلباتي». القرار النهائي للتاجر؛ هنا نرسل الطلب منظماً فقط.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, Link2, Loader2, RotateCcw, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/store/cart";
import { MediaUploadButton } from "@/components/storefront/MediaUploadButton";
import { reorderAction, requestCancelAction, requestReturnAction } from "@/server/actions/order-requests";
import { cn } from "@/lib/utils";

const SW = 1.75;
const BOX = "s-input w-full border bg-[var(--background)] px-3.5 py-3 text-base outline-none focus:ring-2 focus:ring-[var(--primary)]/35";

type Item = { id: string; name: string; variantLabel: string | null; quantity: number; unitPiasters: number };

export function OrderActions({
  subdomain,
  code,
  accessPhone,
  canCancel,
  cancelRequested,
  returnKinds,
  returnDaysLeft,
  returnOpen,
  items,
  link,
}: {
  subdomain: string;
  code: string;
  accessPhone?: string;
  canCancel: boolean;
  cancelRequested: boolean;
  returnKinds: ("exchange" | "refund")[];
  returnDaysLeft: number;
  returnOpen: boolean;
  items: Item[];
  link: string;
}) {
  const router = useRouter();
  const add = useCart((s) => s.add);
  const [pending, start] = useTransition();
  const [cancelSent, setCancelSent] = useState(cancelRequested);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [returning, setReturning] = useState(false);
  const [returnSent, setReturnSent] = useState(returnOpen);
  const [copied, setCopied] = useState(false);

  const reorder = () =>
    start(async () => {
      const r = await reorderAction(subdomain, { code, accessPhone });
      if (!r.ok) return void toast.error(r.error);
      if (!r.data.items.length) return void toast.error("المنتجات في هذا الطلب لم تعد متاحة حالياً");
      for (const { qty, ...it } of r.data.items) add(it, qty);
      if (r.data.dropped) toast.message(`أُضيفت المنتجات المتاحة بأسعارها الحالية، و${r.data.dropped} غير متاح`);
      router.push("/cart");
    });

  const cancel = () =>
    start(async () => {
      const r = await requestCancelAction(subdomain, { code, accessPhone });
      if (!r.ok) return void toast.error(r.error);
      setCancelSent(true);
      setConfirmCancel(false);
      toast.success("تم إرسال طلب الإلغاء للمتجر");
      router.refresh();
    });

  return (
    <section className="surface space-y-4 p-5 text-start" aria-labelledby="oa-h">
      <h2 id="oa-h" className="text-lg">خيارات الطلب</h2>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={reorder} disabled={pending} className="s-btn-ghost h-11 px-4 text-sm">
          {pending ? <Loader2 className="size-4 animate-spin" strokeWidth={SW} aria-hidden="true" /> : <RotateCcw className="size-4" strokeWidth={SW} aria-hidden="true" />}
          إعادة الطلب
        </button>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            } catch {
              toast.error("تعذّر النسخ");
            }
          }}
          className="s-btn-ghost h-11 px-4 text-sm"
        >
          {copied ? <Check className="size-4" strokeWidth={2.25} aria-hidden="true" /> : <Link2 className="size-4" strokeWidth={SW} aria-hidden="true" />}
          {copied ? "تم نسخ الرابط" : "نسخ رابط طلباتي"}
        </button>
        {canCancel && !cancelSent ? (
          <button type="button" onClick={() => setConfirmCancel(true)} className="s-btn-ghost h-11 px-4 text-sm">
            <Ban className="size-4" strokeWidth={SW} aria-hidden="true" /> طلب إلغاء
          </button>
        ) : null}
        {returnKinds.length && !returnSent ? (
          <button type="button" onClick={() => setReturning(true)} className="s-btn-ghost h-11 px-4 text-sm">
            <Undo2 className="size-4" strokeWidth={SW} aria-hidden="true" /> طلب استبدال أو استرجاع
          </button>
        ) : null}
      </div>
      <p className="text-xs leading-6 text-muted-foreground">احفظوا «رابط طلباتي» لفتح الطلب من أي جهاز دون حساب.</p>
      {cancelSent ? <p role="status" className="rounded-xl bg-muted p-3 text-sm font-bold">تم إرسال طلب الإلغاء، وسيتواصل معكم المتجر لتأكيده.</p> : null}
      {returnSent ? <p role="status" className="rounded-xl bg-muted p-3 text-sm font-bold">تم استلام طلب الاستبدال أو الاسترجاع، وسيتواصل معكم المتجر.</p> : null}

      {confirmCancel ? (
        <div role="alertdialog" aria-label="تأكيد طلب الإلغاء" className="space-y-3 rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm font-bold">إرسال طلب إلغاء الطلب {code} للمتجر؟ يعتمد الإلغاء على مرحلة تجهيز الطلب.</p>
          <div className="flex gap-2">
            <button type="button" onClick={cancel} disabled={pending} className="s-btn h-11 px-5 text-sm">{pending ? "جارٍ الإرسال" : "نعم، إرسال طلب الإلغاء"}</button>
            <button type="button" onClick={() => setConfirmCancel(false)} className="s-btn-ghost h-11 px-5 text-sm">رجوع</button>
          </div>
        </div>
      ) : null}

      {returning ? (
        <ReturnForm
          subdomain={subdomain}
          code={code}
          accessPhone={accessPhone}
          kinds={returnKinds}
          daysLeft={returnDaysLeft}
          items={items}
          onClose={() => setReturning(false)}
          onSent={() => {
            setReturnSent(true);
            setReturning(false);
            router.refresh();
          }}
        />
      ) : null}
    </section>
  );
}

function ReturnForm({
  subdomain,
  code,
  accessPhone,
  kinds,
  daysLeft,
  items,
  onClose,
  onSent,
}: {
  subdomain: string;
  code: string;
  accessPhone?: string;
  kinds: ("exchange" | "refund")[];
  daysLeft: number;
  items: Item[];
  onClose: () => void;
  onSent: () => void;
}) {
  const [kind, setKind] = useState(kinds[0]!);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const eligible = items.filter((i) => i.unitPiasters > 0);

  const submit = () =>
    start(async () => {
      setError(null);
      const lines = Object.entries(picked).map(([orderItemId, qty]) => ({ orderItemId, qty }));
      if (!lines.length) return setError("اختاروا منتجاً واحداً على الأقل");
      const r = await requestReturnAction(subdomain, { code, accessPhone, kind, items: lines, reason, photos });
      if (!r.ok) return setError(r.error);
      toast.success("تم إرسال الطلب للمتجر");
      onSent();
    });

  return (
    <form className="space-y-4 rounded-xl border p-4" style={{ borderColor: "var(--border)" }} onSubmit={(e) => { e.preventDefault(); submit(); }} aria-label="طلب استبدال أو استرجاع">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold">الطلب متاح خلال {daysLeft} {daysLeft === 1 ? "يوم" : "أيام"} متبقية من مدة السياسة.</p>
        <button type="button" onClick={onClose} aria-label="إغلاق" className="grid size-8 place-items-center rounded-lg opacity-70 hover:opacity-100"><X className="size-4" strokeWidth={SW} aria-hidden="true" /></button>
      </div>
      {kinds.length > 1 ? (
        <div role="radiogroup" aria-label="نوع الطلب" className="flex gap-2">
          {kinds.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={cn("s-chip h-10 flex-1 border px-4 text-sm font-bold", kind === k && "ring-2 ring-[var(--primary)]")} style={{ borderColor: "var(--border)" }}>
              {k === "exchange" ? "استبدال" : "استرجاع"}
            </button>
          ))}
        </div>
      ) : null}
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-bold">المنتجات</legend>
        {eligible.map((i) => {
          const on = picked[i.id] !== undefined;
          return (
            <div key={i.id} className="flex items-center gap-3 rounded-lg border p-2.5" style={{ borderColor: "var(--border)" }}>
              <input id={`rt-${i.id}`} type="checkbox" className="size-5 accent-[var(--primary)]" checked={on} onChange={(e) => setPicked((p) => { const n = { ...p }; if (e.target.checked) n[i.id] = i.quantity; else delete n[i.id]; return n; })} />
              <label htmlFor={`rt-${i.id}`} className="min-w-0 flex-1 text-sm">
                <span className="font-bold">{i.name}</span>
                {i.variantLabel ? <span className="block text-xs opacity-70">{i.variantLabel}</span> : null}
              </label>
              {on && i.quantity > 1 ? (
                <select aria-label={`الكمية من ${i.name}`} className="s-input h-9 border bg-[var(--background)] px-2 text-sm" value={picked[i.id]} onChange={(e) => setPicked((p) => ({ ...p, [i.id]: Number(e.target.value) }))}>
                  {Array.from({ length: i.quantity }, (_, n) => n + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              ) : null}
            </div>
          );
        })}
      </fieldset>
      <div>
        <label htmlFor="rt-reason" className="mb-1.5 block text-sm font-bold">السبب</label>
        <textarea id="rt-reason" className={cn(BOX, "min-h-[84px] resize-y")} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-bold">صور المنتج <span className="text-xs font-normal opacity-60">اختياري، حتى 4</span></p>
        {photos.length ? (
          <ul className="flex flex-wrap gap-2">
            {photos.map((u) => (
              <li key={u} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="صورة مرفقة" className="size-16 rounded-lg border object-cover" style={{ borderColor: "var(--border)" }} />
                <button type="button" aria-label="حذف الصورة" onClick={() => setPhotos((p) => p.filter((x) => x !== u))} className="absolute -end-1.5 -top-1.5 grid size-6 place-items-center rounded-full border bg-[var(--background)]" style={{ borderColor: "var(--border)" }}><X className="size-3.5" strokeWidth={SW} aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        ) : null}
        {photos.length < 4 ? <MediaUploadButton route="returnPhoto" input={{ subdomain }} label="رفع صورة" onUploaded={(u) => setPhotos((p) => [...p, u].slice(0, 4))} onError={(m) => toast.error(m)} /> : null}
      </div>
      {error ? <p role="alert" className="text-sm font-bold text-danger">{error}</p> : null}
      <button type="submit" disabled={pending} className="s-btn h-12 w-full text-sm">
        {pending ? <Loader2 className="size-4 animate-spin" strokeWidth={SW} aria-hidden="true" /> : null}
        {pending ? "جارٍ الإرسال" : "إرسال الطلب"}
      </button>
    </form>
  );
}
