"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Globe, Link2 } from "lucide-react";
import {
  setStoreStatusAction,
  changeSubdomainAction,
  resendMagicLinkAction,
  exportBlueprintAction,
  toggleShowcaseAction,
  softDeleteStoreAction,
  toggleAcceptingAction,
} from "@/server/actions/platform-stores";
import {
  deliverNowAction,
  extendAction,
  retryBuildAction,
  freezeNowAction,
} from "@/server/actions/platform-ops";
import { bindCustomDomainAction } from "@/server/actions/platform-stores-governance";
import { SnapshotDiffViewer } from "./SnapshotDiffViewer";
import type { StoreBlueprint } from "@/blueprint/schema";

type S = {
  id: string;
  status: string;
  subdomain: string;
  customDomain: string | null;
  showcase: boolean;
  acceptingOrders: boolean;
};

export function StoreAdminActions({
  store: s,
  merchantActivated,
  hasBlueprint,
  currentBp,
  snapshots,
}: {
  store: S;
  merchantActivated: boolean;
  hasBlueprint: boolean;
  currentBp: StoreBlueprint;
  snapshots: any[];
}) {
  const [p, start] = useTransition();
  const [sub, setSub] = useState(s.subdomain);
  const [domain, setDomain] = useState(s.customDomain || "");

  const go = (fn: () => Promise<any>, ok: string) =>
    start(async () => {
      try {
        const r = await fn();
        if (r?.error) {
          toast.error(r.error);
          return;
        }
        toast.success(ok);
      } catch (e) {
        toast.error(String(e));
      }
    });

  const B = "rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-40 transition-colors";

  return (
    <div className="rounded-3xl border border-white/10 bg-[#0b0f2a] p-5 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <p className="text-sm font-black text-white">إجراءات الحوكمة والتحكم (Owner)</p>
        {hasBlueprint && (
          <SnapshotDiffViewer storeId={s.id} currentBp={currentBp} snapshots={snapshots} />
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {s.status === "review" && (
          <>
            <button disabled={p} onClick={() => go(() => deliverNowAction(s.id), "تم التسليم")} className={`${B} bg-teal-500 text-black hover:bg-teal-400`}>🚀 سلّم الآن</button>
            <button disabled={p} onClick={() => { const h = Number(prompt("مدّ المراجعة كم ساعة؟", "2")); if (h) go(() => extendAction(s.id, "deliver", h), "تم التمديد"); }} className={`${B} bg-white/10 hover:bg-white/20 text-white`}>⏱ مدّ المراجعة</button>
          </>
        )}
        {s.status === "trial" && (
          <>
            <button disabled={p} onClick={() => { const h = Number(prompt("مدّ التجربة كم ساعة؟", "24")); if (h) go(() => extendAction(s.id, "trial", h), "تم التمديد"); }} className={`${B} bg-white/10 hover:bg-white/20 text-white`}>⏱ مدّ التجربة</button>
            <button disabled={p} onClick={() => confirm("تجميد المتجر الآن؟") && go(() => freezeNowAction(s.id), "تم التجميد")} className={`${B} bg-rose-500/20 text-rose-300 hover:bg-rose-500/30`}>🔒 جمّد الآن</button>
          </>
        )}
        {s.status === "frozen" && (
          <button disabled={p} onClick={() => { const d = Number(prompt("مدّ فترة السماح كم يوم؟", "7")); if (d) go(() => extendAction(s.id, "grace", d * 24), "تم التمديد"); }} className={`${B} bg-white/10 hover:bg-white/20 text-white`}>⏱ مدّ السماح</button>
        )}
        {["trial", "frozen", "review"].includes(s.status) && (
          <button disabled={p} onClick={() => confirm("تفعيل المتجر بدون دفع (هدية)؟") && go(async () => { await setStoreStatusAction(s.id, "active"); if (!merchantActivated) await resendMagicLinkAction(s.id); }, "تم التفعيل")} className={`${B} bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30`}>🎁 تفعيل استثنائي</button>
        )}
        {s.status === "active" && (
          <button disabled={p} onClick={() => confirm("تعليق المتجر؟") && go(() => setStoreStatusAction(s.id, "suspended"), "تم التعليق")} className={`${B} bg-rose-500/20 text-rose-300 hover:bg-rose-500/30`}>⛔ تعليق فوري</button>
        )}
        {s.status === "suspended" && (
          <button disabled={p} onClick={() => go(() => setStoreStatusAction(s.id, "active"), "أُعيد التفعيل")} className={`${B} bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30`}>✅ إلغاء التعليق</button>
        )}
        {(s.status === "intake" || s.status === "building") && (
          <button disabled={p} onClick={() => go(() => retryBuildAction(s.id), "أُعيد البناء")} className={`${B} bg-amber-500 text-black hover:bg-amber-400`}>🔁 إعادة البناء</button>
        )}
        {!merchantActivated && ["active"].includes(s.status) && (
          <button disabled={p} onClick={() => go(() => resendMagicLinkAction(s.id), "أُرسل الرابط")} className={`${B} bg-white/10 hover:bg-white/20 text-white`}>🔗 إرسال رابط الدخول</button>
        )}
        <button disabled={p} onClick={() => go(() => toggleAcceptingAction(s.id, !s.acceptingOrders), s.acceptingOrders ? "أُوقف الاستقبال" : "أُعيد الاستقبال")} className={`${B} bg-white/10 hover:bg-white/20 text-white`}>{s.acceptingOrders ? "😴 وضع الإجازة" : "🟢 استقبال الطلبات"}</button>
        <button disabled={p} onClick={() => go(() => toggleShowcaseAction(s.id, !s.showcase), "تم")} className={`${B} bg-white/10 hover:bg-white/20 text-white`}>{s.showcase ? "🙈 إخفاء من المعرض" : "🌟 إظهار في المعرض"}</button>
        {hasBlueprint && (
          <button disabled={p} onClick={() => start(async () => { const j = await exportBlueprintAction(s.id); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([j], { type: "application/json" })); a.download = `${s.subdomain}-blueprint.json`; a.click(); })} className={`${B} bg-white/10 hover:bg-white/20 text-white`}>⬇ تصدير JSON</button>
        )}
        <button disabled={p} onClick={() => prompt(`للحذف اكتب: ${s.subdomain}`) === s.subdomain && go(() => softDeleteStoreAction(s.id), "حُذف")} className={`${B} border border-rose-500/40 text-rose-300 hover:bg-rose-500/10`}>🗑 حذف المتجر</button>
      </div>

      <div className="grid md:grid-cols-2 gap-4 pt-3 border-t border-white/5">
        <div className="flex items-center gap-2 bg-white/[0.02] p-2 rounded-xl border border-white/5">
          <Link2 className="size-4 text-slate-400 shrink-0" />
          <input value={sub} onChange={(e) => setSub(e.target.value.toLowerCase())} dir="ltr" className="w-full bg-transparent font-mono text-xs text-white outline-none" placeholder="subdomain" />
          <span className="text-xs text-slate-500 shrink-0" dir="ltr">.colapia.com</span>
          {sub !== s.subdomain && (
            <button disabled={p} onClick={() => confirm("تغيير الرابط يقطع الروابط القديمة. متابعة؟") && go(() => changeSubdomainAction(s.id, sub), "تم التغيير")} className="bg-teal-500 text-black px-2 py-1 rounded text-[10px] font-bold shrink-0">حفظ</button>
          )}
        </div>

        <div className="flex items-center gap-2 bg-white/[0.02] p-2 rounded-xl border border-white/5">
          <Globe className="size-4 text-slate-400 shrink-0" />
          <input value={domain} onChange={(e) => setDomain(e.target.value.toLowerCase())} dir="ltr" className="w-full bg-transparent font-mono text-xs text-white outline-none" placeholder="customdomain.com" />
          {domain !== (s.customDomain || "") && (
            <button disabled={p} onClick={() => go(() => bindCustomDomainAction(s.id, domain), "تم ربط الدومين")} className="bg-[#6f86ff] text-white px-2 py-1 rounded text-[10px] font-bold shrink-0">ربط DNS</button>
          )}
        </div>
      </div>
    </div>
  );
}