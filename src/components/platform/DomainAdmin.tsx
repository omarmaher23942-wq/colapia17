"use client";

// DomainAdmin.tsx — في صفحة المتجر بلوحة الوكالة: حالة النطاق الخاص وتأكيد إضافته يدوياً عند مزود الاستضافة (بلا توكن)، وتنزيل مشروع
// المتجر لتسليم الكود.
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Globe } from "lucide-react";
import { toast } from "sonner";
import { confirmDomainAddedAction } from "@/server/actions/platform-stores-governance";

const LABEL: Record<string, string> = { pending: "DNS لا يشير إلينا بعد", awaiting_team: "يشير إلينا: أضفه عند مزود الاستضافة ثم أكّد", active: "يعمل" };

export function DomainAdmin({ storeId, domain, status, auto, codeRequestedAt }: { storeId: string; domain: string | null; status: string | null; auto: boolean; codeRequestedAt: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <section className="space-y-3 rounded-3xl border border-white/10 bg-[#0b0f2a] p-5 text-[#eaf0ff]">
      <h2 className="flex items-center gap-2 text-sm font-black">
        <Globe className="size-4 text-[#8fa8ff]" aria-hidden="true" /> النطاق الخاص وتسليم الكود
      </h2>
      {domain ? (
        <div className="space-y-2 text-[13px]">
          <p dir="ltr" className="font-mono">{domain}</p>
          <p className="text-[#c3cdf0]">{LABEL[status ?? "pending"] ?? status}</p>
          {!auto && status !== "active" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await confirmDomainAddedAction(storeId);
                  if (!r.ok) return void toast.error(r.error);
                  toast.success(r.status === "active" ? "النطاق يعمل الآن" : "سُجّل التأكيد؛ سيعمل متى أشار DNS إلينا");
                  router.refresh();
                })
              }
              className="min-h-10 rounded-xl bg-[#8fa8ff] px-4 text-[12.5px] font-black text-[#07091a] disabled:opacity-50"
            >
              أضفته (Cloudflare: Custom Hostnames، أو Vercel: Domains): أكّد
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-[13px] text-[#8d97c4]">لا نطاق خاص.</p>
      )}
      <div className="border-t border-white/10 pt-3 text-[13px]">
        {codeRequestedAt ? <p className="mb-2 font-bold text-amber-200">طلب العميل نسخة الكود في {new Date(codeRequestedAt).toLocaleString("ar-EG-u-nu-latn", { timeZone: "Africa/Cairo" })}.</p> : null}
        <a href={`/admin/stores/${storeId}/project`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 px-4 text-[12.5px] font-black">
          <Download className="size-4" aria-hidden="true" /> نزّل مشروع المتجر (ZIP)
        </a>
        <p className="mt-2 text-[12px] text-[#8d97c4]">مشروع مستقل لهذا المتجر وحده (المتجر ولوحته وبياناته المحقونة) بدليل تشغيله، لتسليمه للعميل عند طلبه.</p>
      </div>
    </section>
  );
}
