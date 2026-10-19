"use client";

// PreviewPane — معاينة حية لمتجر التاجر داخل إطار جوال. تُعاد تحميلها بعد كل حفظ (المفتاح `version`)، وتدخل عبر
// /dashboard/preview الذي يمنح صاحب المتجر تصريح معاينة قصير الأجل لأن المتجر مخفي عن الزوار قبل التفعيل.
import { useEffect, useRef, useState } from "react";
import { ExternalLink, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";

// رقم فريد في رابط صفحة المتجر نفسها (لا في رابط التحويل فقط): أي ذاكرة وسيطة للمتصفح أو الشبكة مفتاحها الرابط
// فلا تُعرض نسخة قديمة بعد الحفظ.
const SRC = (v: number, stamp: number) => `/dashboard/preview?to=${encodeURIComponent(`/?_pv=${stamp.toString(36)}`)}&v=${v}`;

export function PreviewFrame({ version, className }: { version: number; className?: string }) {
  const [loaded, setLoaded] = useState(false);
  // الرقم يُولَّد في المتصفح بعد التحميل (لا أثناء العرض على الخادم) فلا يختلف العرضان.
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    setLoaded(false);
    setSrc(SRC(version, Date.now()));
  }, [version]);
  return (
    <div className={cn("relative mx-auto aspect-[9/17] w-full max-w-[380px] overflow-hidden rounded-[2.2rem] border-[7px] border-ink/85 bg-white shadow-2xl", className)}>
      {!loaded ? (
        <div className="absolute inset-0 grid place-items-center bg-edge/[0.04]" aria-hidden="true">
          <span className="size-6 animate-spin rounded-full border-[3px] border-nova/25 border-t-nova motion-reduce:animate-none" />
        </div>
      ) : null}
      {src ? <iframe key={src} src={src} title="معاينة متجركم" onLoad={() => setLoaded(true)} className="size-full border-0 bg-white" /> : null}
    </div>
  );
}

export function PreviewPane({ version, onRefresh }: { version: number; onRefresh: () => void }) {
  return (
    <aside aria-label="معاينة المتجر" className="hidden h-full flex-col items-center gap-3 overflow-y-auto border-s border-edge/10 bg-edge/[0.02] p-5 lg:flex">
      <div className="flex w-full max-w-[380px] items-center justify-between">
        <p className="text-[12.5px] font-black text-ink">معاينة متجركم</p>
        <div className="flex gap-1">
          <button type="button" onClick={onRefresh} aria-label="تحديث المعاينة" className="grid size-9 place-items-center rounded-lg text-ink-3 hover:bg-edge/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50">
            <RefreshCw className="size-4" aria-hidden="true" />
          </button>
          <a href={SRC(version, version)} target="_blank" rel="noreferrer" aria-label="فتح المعاينة في تبويب جديد" className="grid size-9 place-items-center rounded-lg text-ink-3 hover:bg-edge/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50">
            <ExternalLink className="size-4" aria-hidden="true" />
          </a>
        </div>
      </div>
      <PreviewFrame version={version} />
      <p className="max-w-[340px] text-center text-[11.5px] leading-5 text-ink-3">هذه المعاينة لكم وحدكم، ولا يراها الزوار قبل التفعيل. تتحدث تلقائياً بعد كل حفظ.</p>
    </aside>
  );
}

/** ورقة المعاينة للجوال: زر عائم يفتحها كنافذة من أسفل الشاشة. */
export function PreviewSheet({ version }: { version: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="fixed bottom-4 start-4 z-30 inline-flex min-h-12 items-center gap-2 rounded-full bg-ink px-5 text-[13px] font-black text-space shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/60 lg:hidden">
        معاينة
      </button>
      <dialog ref={ref} onClose={() => setOpen(false)} onClick={(e) => e.target === ref.current && setOpen(false)} aria-label="معاينة متجركم" className="dash-dialog">
        <div className="flex items-center justify-between border-b border-edge/10 px-5 py-3">
          <h2 className="text-[15px] font-black text-ink">معاينة متجركم</h2>
          <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق" className="grid size-9 place-items-center rounded-lg text-ink-3 hover:bg-edge/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="p-4">{open ? <PreviewFrame version={version} /> : null}</div>
      </dialog>
    </>
  );
}
