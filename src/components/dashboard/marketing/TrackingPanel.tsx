"use client";

// TrackingPanel — «التتبع والإعلانات»: معرّف بكسل ميتا ورمز Conversions API وGA4 وبكسل تيك توك ووسم Search Console.
// التاجر يلصق ما ينسخه من كل منصة كما هو (حتى الكود كاملاً)، والخادم يستخرج المعرّف ويتحقق منه.
import { useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveTrackingAction } from "@/server/actions/marketing";

type Values = { metaPixelId: string; gaMeasurementId: string; tiktokPixelId: string; googleVerification: string };

const INPUT = "mt-1.5 w-full rounded-xl border border-edge/10 bg-edge/[0.03] px-3 py-2.5 text-[16px] text-ink outline-none focus:border-nova";

export function TrackingPanel({ initial, capiMasked, canEdit }: { initial: Values; capiMasked: string | null; canEdit: boolean }) {
  const [v, setV] = useState(initial);
  const [capi, setCapi] = useState<string | undefined>(undefined);
  const [field, setField] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  const save = () =>
    start(async () => {
      setField(null);
      const r = await saveTrackingAction({ ...v, capiToken: capi });
      if (!r.ok) {
        setField(r.field ?? null);
        return void toast.error(r.error);
      }
      setCapi(undefined);
      toast.success("حُفظ. يبدأ التتبع مع أول زيارة لمتجرك");
    });

  const row = (k: keyof Values, label: string, hint: string, placeholder: string, on: boolean) => (
    <div>
      <label htmlFor={k} className="flex items-center gap-1.5 text-[13px] font-bold text-ink">
        {label} {on ? <CheckCircle2 className="size-3.5 text-ok" aria-label="مفعّل" /> : null}
      </label>
      <input id={k} dir="ltr" value={v[k]} onChange={set(k)} disabled={!canEdit} placeholder={placeholder} className={`${INPUT} ${field === k ? "border-bad" : ""}`} />
      <p className="mt-1 text-[11.5px] leading-5 text-ink-3">{hint}</p>
    </div>
  );

  return (
    <section className="dash-card space-y-4 p-5">
      <header>
        <h2 className="text-[15px] font-black text-ink">التتبع والإعلانات</h2>
        <p className="mt-1 text-[12.5px] leading-6 text-ink-2">
          اربط متجرك بحساباتك الإعلانية لتعرف أي إعلان يجلب طلبات، ولتعيد استهداف من زار متجرك. الأحداث المرسلة: زيارة الصفحة، مشاهدة منتج، الإضافة للسلة، بدء الطلب، والشراء بقيمته.
        </p>
      </header>
      {row("metaPixelId", "بكسل ميتا (فيسبوك وإنستجرام)", "مدير الأحداث ← مصادر البيانات ← انسخ رقم البكسل (أو الصق الكود كله).", "123456789012345", Boolean(initial.metaPixelId))}
      <div>
        <label htmlFor="capi" className="flex items-center gap-1.5 text-[13px] font-bold text-ink">
          رمز Conversions API من ميتا (اختياري، موصى به) {capiMasked && capi === undefined ? <CheckCircle2 className="size-3.5 text-ok" aria-label="مفعّل" /> : null}
        </label>
        <input
          id="capi"
          dir="ltr"
          type="password"
          autoComplete="off"
          value={capi ?? ""}
          onChange={(e) => setCapi(e.target.value)}
          disabled={!canEdit}
          placeholder={capiMasked ? `محفوظ ${capiMasked} — اكتب رمزاً جديداً لاستبداله` : "EAAG..."}
          className={`${INPUT} ${field === "capiToken" ? "border-bad" : ""}`}
        />
        <p className="mt-1 text-[11.5px] leading-5 text-ink-3">
          مدير الأحداث ← البكسل ← الإعدادات ← «إنشاء رمز وصول». يرسل الشراء من خادمنا مباشرة فيُحسب حتى لو حجب متصفح العميل البكسل، ولا يُحسب مرتين.
          {capiMasked && canEdit ? (
            <button type="button" onClick={() => setCapi("")} className="ms-1 font-bold text-bad underline-offset-2 hover:underline">
              احذف الرمز
            </button>
          ) : null}
        </p>
      </div>
      {row("gaMeasurementId", "Google Analytics 4", "مسؤول ← مصادر البيانات ← ويب ← معرّف القياس (يبدأ بـ G-).", "G-XXXXXXXXXX", Boolean(initial.gaMeasurementId))}
      {row("tiktokPixelId", "بكسل تيك توك", "مدير الإعلانات ← الأصول ← الأحداث ← انسخ معرّف البكسل.", "C4ABCDEFGHIJKLMNOP", Boolean(initial.tiktokPixelId))}
      {row("googleVerification", "التحقق من Google Search Console", "أضف موقعك بنوع «بادئة عنوان URL» واختر «علامة HTML»، والصق الوسم هنا ثم اضغط «تحقق» هناك.", '<meta name="google-site-verification" content="...">', Boolean(initial.googleVerification))}
      {canEdit ? (
        <button type="button" onClick={save} disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-nova px-5 text-[13.5px] font-black text-white disabled:opacity-50">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null} احفظ
        </button>
      ) : null}
    </section>
  );
}
