import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { CheckCircle2, XCircle, Wallet, ExternalLink, ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";
import { db } from "@/db/client";
import { platformPayments, stores, merchants } from "@/db/schema";
import { formatEgp } from "@/lib/money";
import { PaymentDecision } from "@/components/platform/PaymentDecision";
import { RevokePayment } from "@/components/platform/RevokePayment";
import { AutoRefresh } from "@/components/platform/AutoRefresh";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function safeDateStr(d: unknown): string {
  if (!d) return "—";
  try {
    const dateObj = typeof d === "string" || typeof d === "number" ? new Date(d) : (d as Date);
    if (isNaN(dateObj.getTime())) return "—";
    return dateObj.toLocaleString("ar-EG", { timeZone: "Africa/Cairo" });
  } catch {
    return "—";
  }
}

export default async function PaymentsReviewPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view = "pending" } = await searchParams;

  const rows = await db
    .select({
      pId: platformPayments.id,
      pAmount: platformPayments.amountPiasters,
      pKind: platformPayments.kind,
      pMethod: platformPayments.method,
      pSenderPhone: platformPayments.senderPhone,
      pScreenshotUrl: platformPayments.screenshotUrl,
      pStatus: platformPayments.status,
      pReviewedBy: platformPayments.reviewedBy,
      pReviewNote: platformPayments.reviewNote,
      pAiVerification: platformPayments.aiVerification,
      pCreatedAt: platformPayments.createdAt,
      sId: stores.id,
      sName: stores.name,
      sSubdomain: stores.subdomain,
      mName: merchants.displayName,
    })
    .from(platformPayments)
    .leftJoin(stores, eq(stores.id, platformPayments.storeId))
    .leftJoin(merchants, eq(merchants.id, stores.merchantId))
    .where(
      view === "pending"
        ? eq(platformPayments.status, "under_review")
        : view === "auto"
          ? and(eq(platformPayments.status, "confirmed"), isNull(platformPayments.reviewedBy))
          : undefined
    )
    .orderBy(desc(platformPayments.createdAt))
    .limit(100);

  return (
    <div className="space-y-6 bg-[#07091a] text-[#eaf0ff]" dir="rtl">
      <AutoRefresh everyMs={12000} />

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Wallet className="size-6 text-emerald-400" />
            تدقيق التحويلات المالية
          </h1>
          <p className="mt-1 text-xs text-[#c3cdf0]/70">
            الذكاء الاصطناعي يقرأ الإيصالات ويقارن المبالغ، وتأكيد التفعيل (أو تمديد الاستضافة سنة) بضغطة زر منك.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#0b0f2a] p-1.5 rounded-xl border border-white/10">
          <Link href="?view=pending" className={cn("rounded-lg px-4 py-2 text-xs font-bold transition-all", view === "pending" ? "bg-[#6f86ff] text-white shadow-md" : "text-slate-400 hover:text-white")}>
            بانتظار المراجعة ({rows.filter((r) => r.pStatus === "under_review").length})
          </Link>
          <Link href="?view=auto" className={cn("rounded-lg px-4 py-2 text-xs font-bold transition-all", view === "auto" ? "bg-[#6f86ff] text-white shadow-md" : "text-slate-400 hover:text-white")}>
            قُبلت آلياً (قديماً)
          </Link>
          <Link href="?view=all" className={cn("rounded-lg px-4 py-2 text-xs font-bold transition-all", view === "all" ? "bg-[#6f86ff] text-white shadow-md" : "text-slate-400 hover:text-white")}>
            سجل التحويلات
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {rows.map((r) => {
          const v = r.pAiVerification as any;
          const rec: string | undefined = v?.recommendation;

          return (
            <div key={r.pId} className={cn("rounded-3xl border p-6 shadow-2xl backdrop-blur-xl space-y-5", r.pStatus === "under_review" ? (rec === "approve" ? "border-teal-500/50 bg-teal-500/[0.04]" : rec === "reject" ? "border-rose-500/50 bg-rose-500/[0.04]" : "border-amber-500/40 bg-amber-500/[0.03]") : "border-white/10 bg-[#0b0f2a]")}>
              <div className="flex items-start gap-5">
                {r.pScreenshotUrl ? (
                  <a href={r.pScreenshotUrl} target="_blank" rel="noopener noreferrer" className="group relative h-56 w-36 shrink-0 overflow-hidden rounded-2xl border border-white/20 bg-black/40 shadow-lg">
                    <img src={r.pScreenshotUrl} alt="إيصال" className="size-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    <span className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center">
                      <ExternalLink className="size-6 text-white" />
                    </span>
                  </a>
                ) : (
                  <div className="grid h-56 w-36 shrink-0 place-items-center rounded-2xl bg-white/5 text-xs font-bold text-slate-500 border border-white/10">بدون صورة</div>
                )}

                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link href={r.sId ? `/admin/stores/${r.sId}` : "#"} className="text-lg font-black text-white hover:text-[#8fa8ff] block truncate">
                        {r.sName || "متجر غير معروف"}
                      </Link>
                      <p className="text-xs text-[#8d97c4] font-mono mt-0.5" dir="ltr">{r.sSubdomain ? `${r.sSubdomain}.colapia.com` : "—"}</p>
                    </div>
                    <span className="rounded-xl bg-emerald-500/20 text-emerald-300 px-3 py-1.5 text-sm font-black font-mono border border-emerald-500/30 shadow-sm">
                      {r.pKind === "renewal" ? "تجديد · " : "باقة · "}
                      {formatEgp(r.pAmount)}
                    </span>
                  </div>

                  <div className="rounded-xl bg-[#07091a] p-3 text-xs space-y-1.5 text-slate-300 border border-white/5">
                    <p className="flex justify-between"><span className="text-slate-500">التاجر:</span> <b>{r.mName || "غير مسجل"}</b></p>
                    <p className="flex justify-between"><span className="text-slate-500">الوسيلة:</span> <b>{r.pMethod === "vodafone_cash" ? "فودافون كاش" : "إنستاباي"}</b></p>
                    <p className="flex justify-between"><span className="text-slate-500">رقم التحويل:</span> <b dir="ltr" className="font-mono text-[#8fa8ff]">{r.pSenderPhone || "غير مسجل"}</b></p>
                    <p className="flex justify-between"><span className="text-slate-500">الوقت:</span> <span className="font-mono text-[10px]">{safeDateStr(r.pCreatedAt)}</span></p>
                  </div>

                  {v ? (
                    <div className={cn("rounded-xl border p-3 text-xs space-y-1.5", rec === "approve" ? "border-teal-500/40 bg-teal-500/10 text-teal-200" : rec === "reject" ? "border-rose-500/40 bg-rose-500/10 text-rose-200" : "border-amber-500/40 bg-amber-500/10 text-amber-200")}>
                      <div className="flex items-center justify-between font-bold">
                        <span className="flex items-center gap-1.5">
                          {rec === "approve" ? <ShieldCheck className="size-4 text-teal-400" /> : rec === "reject" ? <XCircle className="size-4 text-rose-400" /> : <AlertTriangle className="size-4 text-amber-400" />}
                          {rec === "approve" ? "مطابق للمتوقع" : rec === "reject" ? "غير مطابق" : "يحتاج فحصك اليدوي"}
                        </span>
                        <span className="font-mono bg-black/20 px-2 py-0.5 rounded-md">ثقة {Math.round((v.confidence ?? 0) * 100)}%</span>
                      </div>
                      <p className="text-[11px] leading-relaxed opacity-90">{v.reason}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 flex items-center gap-1.5"><Loader2 className="size-3.5 animate-spin" /> جاري الفحص بالذكاء الاصطناعي...</p>
                  )}
                </div>
              </div>

              {r.pStatus === "under_review" ? (
                <div className="border-t border-white/10 pt-4">
                  <PaymentDecision id={r.pId} suggested={rec} />
                </div>
              ) : (
                <div className="border-t border-white/10 pt-3 text-xs font-bold flex justify-center">
                  {r.pStatus === "confirmed" && !r.pReviewedBy ? (
                    <div className="flex w-full flex-wrap items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-300">
                        <ShieldCheck className="size-4" /> قُبل فورياً آلياً{r.pReviewNote ? ` · ${r.pReviewNote}` : ""}
                      </span>
                      <RevokePayment id={r.pId} />
                    </div>
                  ) : r.pStatus === "confirmed" ? (
                    <span className="text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20"><CheckCircle2 className="size-4" /> تم التأكيد وتفعيل المتجر</span>
                  ) : (
                    <span className="text-rose-400 flex items-center gap-1.5 bg-rose-500/10 px-4 py-2 rounded-xl border border-rose-500/20"><XCircle className="size-4" /> تم الرفض وإبلاغ التاجر بالسبب</span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {rows.length === 0 && (
          <div className="col-span-2 rounded-3xl border border-dashed border-white/10 p-20 text-center text-slate-400 space-y-3">
            <Wallet className="size-12 mx-auto opacity-20" />
            <p className="text-sm font-bold">{view === "pending" ? "لا توجد تحويلات جديدة بانتظار التأكيد 🎉" : "لا توجد أي تحويلات مسجلة بعد"}</p>
          </div>
        )}
      </div>
    </div>
  );
}