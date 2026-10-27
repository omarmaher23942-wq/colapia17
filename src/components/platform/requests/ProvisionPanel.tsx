"use client";
// ProvisionPanel — زر «جهّز المتجر وولّد رابط الإعداد» ونتيجته (رابط موقّع + رسالة جاهزة بأزرار نسخ) و«أعيدوا إرسال رابط إعداد».
import { useState, useTransition } from "react";
import { provisionRequestAction, reissueSetupLinkAction, type SetupLinkResult } from "@/server/actions/provision-request";
import { CopyButton } from "./ProjectLinks";

const BTN = "inline-flex min-h-11 items-center justify-center rounded-xl bg-[#6f86ff] px-4 text-[13px] font-black text-[#050716] disabled:opacity-60";

export function ProvisionPanel({ id, provisioned, suggestedSlug }: { id: string; provisioned: boolean; suggestedSlug: string | null }) {
  const [slug, setSlug] = useState(suggestedSlug ?? "");
  const [res, setRes] = useState<SetupLinkResult | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<SetupLinkResult>) => start(async () => setRes(await fn()));

  return (
    <div className="space-y-3">
      {!provisioned && !(res && res.ok) ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="block text-[12.5px] font-bold text-[#8d97c4]">
            النطاق الفرعي (اختياري، يُقترح تلقائياً)
            <input value={slug} onChange={(e) => setSlug(e.target.value)} dir="ltr" placeholder="brand-name" className="mt-1 block min-h-11 w-56 rounded-xl border border-white/15 bg-[#050716] px-3 text-[14px] text-white" />
          </label>
          <button type="button" disabled={pending} className={BTN} onClick={() => run(() => provisionRequestAction({ id, slug: slug || null }))}>
            {pending ? "جارٍ التجهيز..." : "جهّز المتجر وولّد رابط الإعداد"}
          </button>
        </div>
      ) : (
        <button type="button" disabled={pending} className={BTN} onClick={() => run(() => reissueSetupLinkAction({ id }))}>
          {pending ? "جارٍ التوليد..." : "أعيدوا إرسال رابط إعداد"}
        </button>
      )}

      {res && !res.ok ? <p role="alert" className="text-[13px] font-bold text-rose-300">{res.error}</p> : null}
      {res && res.ok ? (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-[#050716] p-3">
          {res.slug ? (
            <p className="text-[12.5px] text-[#8d97c4]">
              جُهِّز المتجر على <span dir="ltr" className="font-mono">{res.slug}</span> ({res.source === "folder" ? "من مجلد الفريق" : "مخطط افتراضي"}، {res.products ?? 0} منتج). العدّاد لم يبدأ: يبدأ عند أول فتح للرابط.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span dir="ltr" className="break-all font-mono text-[12px] text-[#c3cdf0]">{res.setupUrl}</span>
            <CopyButton value={res.setupUrl} label="نسخ الرابط" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[13px] font-black">رابط الإعداد جاهز</h3>
            <CopyButton value={res.message} label="نسخ الرسالة" />
          </div>
          <pre dir="rtl" className="whitespace-pre-wrap text-[12.5px] leading-7 text-[#c3cdf0]">{res.message}</pre>
        </div>
      ) : null}
    </div>
  );
}
