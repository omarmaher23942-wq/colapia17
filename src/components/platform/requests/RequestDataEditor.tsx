"use client";

// RequestDataEditor.tsx — الفريق يصحح بيانات الاستمارة (بعد مكالمة أو رسالة مع العميل). نفس مخطط الاستمارة، وأول
// تعديل يحفظ نسخة العميل الأصلية على الخادم. الملفات تُحذف من هنا ولا تُضاف (الإضافة من رفع العميل فقط).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { COLOR_MODES, DELIVERY_OPTIONS, PAYMENT_OPTIONS, PRODUCT_MODES, type IntakeData } from "@/intake/schema";
import { INTAKE_PALETTES } from "@/intake/palettes";
import { editRequestDataAction } from "@/server/actions/agency-production";
import { cn } from "@/lib/utils";

const input = "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[14px] text-[#eaf0ff] outline-none placeholder:text-[#8d97c4]/70 focus:border-[#6f86ff]";
const label = "block text-[12.5px] font-black text-[#c3cdf0]";
const COLOR_LABEL: Record<(typeof COLOR_MODES)[number], string> = { preset: "لوحة جاهزة", logo: "من الشعار", custom: "لون محدد", team: "سيبها للفريق" };
const PRODUCT_LABEL: Record<(typeof PRODUCT_MODES)[number], string> = { list: "قائمة من العميل", team: "الفريق يجمعها", later: "يضيفها بنفسه لاحقاً" };

export function RequestDataEditor({ id, data, version, imageUrls }: { id: string; data: IntakeData; version: string; imageUrls: Record<string, string> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<IntakeData>(data);
  const [pending, start] = useTransition();

  const set = <K extends keyof IntakeData>(k: K, v: IntakeData[K]) => setD((x) => ({ ...x, [k]: v }));

  if (!open) {
    return (
      <button type="button" onClick={() => (setD(data), setOpen(true))} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-[13px] font-black text-white">
        <Pencil className="size-4" aria-hidden="true" /> عدّل بيانات الطلب
      </button>
    );
  }

  const save = () =>
    start(async () => {
      const r = await editRequestDataAction({ id, data: d, version });
      if (!r.ok) return void toast.error(r.error);
      toast.success("حُفظت البيانات وتحدّث الـ brief والبرومبت");
      setOpen(false);
      router.refresh();
    });

  return (
    <div className="space-y-5 rounded-3xl border border-[#6f86ff]/30 bg-[#0b0f2a] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-black">تعديل بيانات الطلب</h2>
        <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق" className="grid size-10 place-items-center rounded-xl text-[#8d97c4] hover:text-white">
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      <p className="text-[12.5px] text-[#8d97c4]">نسخة العميل الأصلية محفوظة. كل حفظ يُسجَّل باسمك.</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          اسم المتجر
          <input className={cn(input, "mt-1.5")} maxLength={60} value={d.store.name ?? ""} onChange={(e) => set("store", { ...d.store, name: e.target.value })} />
        </label>
        <label className={label}>
          النشاط في سطر
          <input className={cn(input, "mt-1.5")} maxLength={200} value={d.store.oneLine ?? ""} onChange={(e) => set("store", { ...d.store, oneLine: e.target.value })} />
        </label>
        <label className={label}>
          البريد (مالك لوحة المتجر)
          <input className={cn(input, "mt-1.5")} dir="ltr" type="email" maxLength={120} value={d.contact.email ?? ""} onChange={(e) => set("contact", { ...d.contact, email: e.target.value })} />
        </label>
        <label className={label}>
          واتساب
          <input className={cn(input, "mt-1.5")} dir="ltr" inputMode="tel" maxLength={30} value={d.contact.whatsapp ?? ""} onChange={(e) => set("contact", { ...d.contact, whatsapp: e.target.value })} />
        </label>
        <label className={label}>
          رابط الصفحة
          <input className={cn(input, "mt-1.5")} dir="ltr" maxLength={300} value={d.social.url ?? ""} onChange={(e) => set("social", { ...d.social, url: e.target.value })} />
        </label>
        <label className={cn(label, "flex items-center gap-2 self-end pb-3")}>
          <input type="checkbox" checked={d.social.teamCollects} onChange={(e) => set("social", { ...d.social, teamCollects: e.target.checked })} className="size-4 accent-[#6f86ff]" />
          الفريق يجمع المنتجات من الصفحة
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className={label}>الألوان</legend>
        <div className="flex flex-wrap gap-2">
          {COLOR_MODES.map((m) => (
            <button key={m} type="button" onClick={() => set("colors", { ...d.colors, mode: m })} className={cn("min-h-10 rounded-xl border px-3 text-[12.5px] font-black", d.colors.mode === m ? "border-[#6f86ff] bg-[#6f86ff]/20 text-white" : "border-white/10 text-[#c3cdf0]")}>
              {COLOR_LABEL[m]}
            </button>
          ))}
        </div>
        {d.colors.mode === "preset" ? (
          <div className="flex flex-wrap gap-2">
            {INTAKE_PALETTES.map((pl) => (
              <button key={pl.id} type="button" onClick={() => set("colors", { ...d.colors, preset: pl.id })} className={cn("flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-[12px] font-bold", d.colors.preset === pl.id ? "border-[#6f86ff] text-white" : "border-white/10 text-[#c3cdf0]")}>
                <span className="flex h-4 w-10 overflow-hidden rounded">
                  {pl.colors.map((c) => (
                    <span key={c} className="flex-1" style={{ background: c }} />
                  ))}
                </span>
                {pl.name}
              </button>
            ))}
          </div>
        ) : d.colors.mode === "custom" ? (
          <input type="color" value={d.colors.custom ?? "#6f86ff"} onChange={(e) => set("colors", { ...d.colors, custom: e.target.value })} className="h-11 w-20 rounded-xl border border-white/10 bg-transparent" aria-label="اللون" />
        ) : null}
        <label className={cn(label, "flex items-center gap-2")}>
          <input type="checkbox" checked={d.logo.team} onChange={(e) => set("logo", { ...d.logo, team: e.target.checked })} className="size-4 accent-[#6f86ff]" />
          الفريق يصمم شعاراً نصياً
        </label>
        {d.logo.key ? (
          <button type="button" onClick={() => set("logo", { ...d.logo, key: undefined })} className="inline-flex items-center gap-1.5 text-[12px] font-bold text-rose-300">
            <Trash2 className="size-3.5" aria-hidden="true" /> احذف الشعار المرفوع من الطلب
          </button>
        ) : null}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className={label}>المنتجات</legend>
        <div className="flex flex-wrap gap-2">
          {PRODUCT_MODES.map((m) => (
            <button key={m} type="button" onClick={() => set("products", { ...d.products, mode: m })} className={cn("min-h-10 rounded-xl border px-3 text-[12.5px] font-black", d.products.mode === m ? "border-[#6f86ff] bg-[#6f86ff]/20 text-white" : "border-white/10 text-[#c3cdf0]")}>
              {PRODUCT_LABEL[m]}
            </button>
          ))}
        </div>
        <ul className="space-y-2">
          {d.products.items.map((it, i) => (
            <li key={it.id} className="flex items-center gap-2">
              {it.key && imageUrls[it.key] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrls[it.key]} alt="" className="size-11 shrink-0 rounded-lg object-cover" />
              ) : (
                <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-white/5 text-[10px] text-[#8d97c4]">{i + 1}</span>
              )}
              <input
                className={input}
                maxLength={200}
                value={it.line ?? ""}
                placeholder="الاسم، الألوان، المقاسات، السعر"
                onChange={(e) => set("products", { ...d.products, items: d.products.items.map((x) => (x.id === it.id ? { ...x, line: e.target.value } : x)) })}
              />
              <button type="button" aria-label="احذف المنتج" onClick={() => set("products", { ...d.products, items: d.products.items.filter((x) => x.id !== it.id) })} className="grid size-11 shrink-0 place-items-center rounded-xl text-rose-300 hover:bg-rose-500/10">
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset className="space-y-2">
          <legend className={label}>الدفع</legend>
          {PAYMENT_OPTIONS.map((o) => (
            <label key={o.id} className="flex items-center gap-2 text-[13px] font-bold text-[#c3cdf0]">
              <input
                type="checkbox"
                checked={d.payment.methods.includes(o.id)}
                onChange={(e) => set("payment", { ...d.payment, methods: e.target.checked ? [...d.payment.methods, o.id] : d.payment.methods.filter((m) => m !== o.id), unsure: false })}
                className="size-4 accent-[#6f86ff]"
              />
              {o.label}
            </label>
          ))}
          <label className="flex items-center gap-2 text-[13px] font-bold text-[#8d97c4]">
            <input type="checkbox" checked={d.payment.unsure} onChange={(e) => set("payment", { methods: e.target.checked ? [] : d.payment.methods, unsure: e.target.checked })} className="size-4 accent-[#6f86ff]" />
            مش متأكد
          </label>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className={label}>التوصيل</legend>
          <select value={d.delivery.scope ?? ""} onChange={(e) => set("delivery", { ...d.delivery, scope: (e.target.value || undefined) as IntakeData["delivery"]["scope"] })} className={cn(input, "h-11 bg-[#07091a] py-0")}>
            <option value="">—</option>
            {DELIVERY_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <input className={input} maxLength={200} placeholder="تفاصيل (محافظات، مدة، سعر)" value={d.delivery.note ?? ""} onChange={(e) => set("delivery", { ...d.delivery, note: e.target.value })} />
        </fieldset>
      </div>

      <label className={label}>
        موقع إلهام
        <input className={cn(input, "mt-1.5")} dir="ltr" maxLength={300} value={d.inspiration.url ?? ""} onChange={(e) => set("inspiration", { ...d.inspiration, url: e.target.value })} />
      </label>
      {d.voice.key ? (
        <label className={label}>
          تفريغ الرسالة الصوتية (صحّحه بعد السماع)
          <textarea className={cn(input, "mt-1.5 leading-7")} rows={4} maxLength={4000} value={d.voice.transcript ?? ""} onChange={(e) => set("voice", { ...d.voice, transcript: e.target.value })} />
        </label>
      ) : null}
      <label className={label}>
        ملاحظات العميل
        <textarea className={cn(input, "mt-1.5 leading-7")} rows={4} maxLength={2000} value={d.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
      </label>

      <div className="sticky bottom-3 flex gap-2">
        <button type="button" onClick={save} disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#6f86ff] px-5 text-[13.5px] font-black text-[#07091a] shadow-lg disabled:opacity-60">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
          احفظ التعديلات
        </button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-xl px-4 text-[13px] font-bold text-[#8d97c4] hover:text-white">
          إلغاء
        </button>
      </div>
    </div>
  );
}
