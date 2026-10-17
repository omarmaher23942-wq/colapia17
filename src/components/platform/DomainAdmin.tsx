"use client";

// DomainAdmin.tsx — في صفحة المتجر بلوحة الوكالة: حالة النطاق الخاص وتأكيد إضافته يدوياً عند مزود الاستضافة (بلا توكن).
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { toast } from "sonner";
import { confirmDomainAddedAction } from "@/server/actions/platform-stores-governance";

const LABEL: Record<string, string> = { pending: "DNS لا يشير إلينا بعد", awaiting_team: "يشير إلينا: أضفه عند مزود الاستضافة ثم أكّد", active: "يعمل" };

export function DomainAdmin({ storeId, domain, status, auto }: { storeId: string; domain: string | null; status: string | null; auto: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <section className="space-y-3 rounded-3xl border border-white/10 bg-[#0b0f2a] p-5 text-[#eaf0ff]">
      <h2 className="flex items-center gap-2 text-sm font-black">
        <Globe className="size-4 text-[#8fa8ff]" aria-hidden="true" /> النطاق الخاص
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
    </section>
  );
}
