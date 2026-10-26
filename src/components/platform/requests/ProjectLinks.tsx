"use client";

// ProjectLinks.tsx — رابطا مشروع العميل (المستودع والمتجر المنشور) في سجل التسليم. يملؤهما الفريق بعد جلسة التسليم ويعدّلهما
// متى لزم. يظهران للعميل في بوابته وللمالك في صندوق التعديلات.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { saveProjectLinksAction } from "@/server/actions/agency-production";
import { cn } from "@/lib/utils";

const input = "mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-[#07091a] px-3 text-[13px] text-white outline-none focus:border-[#6f86ff]";

export function CopyButton({ value, label = "نسخ" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          toast.error("المتصفح منع النسخ.");
        }
      }}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/15 px-3 text-[12.5px] font-black text-white"
    >
      {done ? <Check className="size-4 text-emerald-400" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
      {done ? "تم النسخ" : label}
    </button>
  );
}

export function ProjectLinks({ id, repoUrl, storeUrl, canEdit }: { id: string; repoUrl: string | null; storeUrl: string | null; canEdit: boolean }) {
  const router = useRouter();
  const [repo, setRepo] = useState(repoUrl ?? "");
  const [store, setStore] = useState(storeUrl ?? "");
  const [pending, start] = useTransition();
  const dirty = repo.trim() !== (repoUrl ?? "") || store.trim() !== (storeUrl ?? "");
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-[12.5px] font-black text-[#c3cdf0]">
          مستودع العميل
          <input dir="ltr" value={repo} onChange={(e) => setRepo(e.target.value)} disabled={!canEdit} placeholder="https://github.com/…" className={cn(input, "text-start")} />
        </label>
        <label className="block text-[12.5px] font-black text-[#c3cdf0]">
          رابط المتجر المنشور
          <input dir="ltr" value={store} onChange={(e) => setStore(e.target.value)} disabled={!canEdit} placeholder="https://…" className={cn(input, "text-start")} />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        {canEdit ? (
          <button
            type="button"
            disabled={pending || !dirty}
            onClick={() =>
              start(async () => {
                const r = await saveProjectLinksAction({ id, repoUrl: repo, storeUrl: store });
                if (!r.ok) return void toast.error(r.error);
                setRepo(r.repoUrl ?? "");
                setStore(r.storeUrl ?? "");
                toast.success("حُفظت الروابط");
                router.refresh();
              })
            }
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#6f86ff] px-4 text-[13px] font-black text-[#07091a] disabled:opacity-50"
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
            حفظ الروابط
          </button>
        ) : null}
        {repoUrl ? <CopyButton value={repoUrl} label="نسخ رابط المستودع" /> : null}
        {storeUrl ? (
          <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/15 px-3 text-[12.5px] font-black text-white">
            <ExternalLink className="size-4" aria-hidden="true" /> فتح المتجر
          </a>
        ) : null}
      </div>
    </div>
  );
}
