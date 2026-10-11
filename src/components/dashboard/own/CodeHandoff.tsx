"use client";

// CodeHandoff.tsx — طلب نسخة كاملة من كود المتجر وبياناته؛ الفريق يجهّزها ويسلّمها. بلا خطوات تقنية على التاجر.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileArchive, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { requestCodeHandoffAction } from "@/server/actions/code-handoff";

export function CodeHandoff({ active, requestedAt, ownedUrl }: { active: boolean; requestedAt: string | null; ownedUrl: string | null }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-black text-ink">
          <FileArchive className="size-5 text-nova-2" aria-hidden="true" /> نسخة من كود متجرك
        </h1>
        <p className="mt-1 text-[13.5px] leading-7 text-ink-2">
          متجرك يعمل عندنا ونحن نتولى استضافته وتشغيله وتحديثه. لو احتجت نسخة كاملة من كوده وبياناته (لمطوّر عندك أو للاحتفاظ بها)، اطلبها هنا وفريقنا يجهّزها ويرسلها لك مع دليل تشغيلها.
        </p>
      </header>
      {ownedUrl ? <p className="dash-card p-4 text-[13.5px] text-ink-2">متجرك يعمل الآن على موقعك: <a href={ownedUrl} className="text-nova-2 underline" dir="ltr">{ownedUrl}</a></p> : null}
      {!active ? <p className="dash-card p-4 text-[13.5px] text-ink-2">متاح بعد دفع الباقة.</p> : null}
      {active ? (
        <section className="dash-card space-y-3 p-4 sm:p-5">
          {requestedAt ? (
            <p className="flex items-center gap-2 text-[14px] font-bold text-ok">
              <CheckCircle2 className="size-4" aria-hidden="true" /> طلبتها في {new Date(requestedAt).toLocaleString("ar-EG-u-nu-latn", { timeZone: "Africa/Cairo", dateStyle: "medium", timeStyle: "short" })}، والفريق سيتواصل معك.
            </p>
          ) : null}
          <label className="block text-[13px] font-bold text-ink-2">
            ملاحظة للفريق (اختيارية): لمن النسخة، وأين تريد استلامها
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} className="mt-1.5 w-full rounded-xl border border-edge/10 bg-edge/[0.03] p-3 text-[14px] leading-7 text-ink outline-none focus:border-nova" />
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await requestCodeHandoffAction(note);
                if (!r.ok) return void toast.error(r.error);
                toast.success("وصل طلبك للفريق");
                setNote("");
                router.refresh();
              })
            }
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-nova px-5 text-[13.5px] font-black text-white disabled:opacity-50"
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {requestedAt ? "أرسل طلباً جديداً" : "اطلب النسخة"}
          </button>
        </section>
      ) : null}
    </div>
  );
}
