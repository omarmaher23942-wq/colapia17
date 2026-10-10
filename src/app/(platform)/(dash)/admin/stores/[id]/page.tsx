import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { getTenantDb } from "@/db/tenant";
import { stores, merchants, orders, platformPayments, storeSnapshots, systemEvents, aiCalls } from "@/db/schema";
import { storeUrl } from "@/lib/utils";
import { formatEgp } from "@/lib/money";
import { StoreAdminActions } from "@/components/platform/StoreAdminActions";
import { StoreRiskAuditCard } from "@/components/platform/StoreRiskAuditCard";
import { getBlueprint } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const fmt = (d: Date | null | undefined) => d ? d.toLocaleString("ar-EG", { timeZone: "Africa/Cairo", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export default async function StoreDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [s] = await db.select().from(stores).where(eq(stores.id, id));
  if (!s) notFound();

  const [[m], [o], pays, snaps, events, bp, aiUse] = await Promise.all([
    db.select().from(merchants).where(eq(merchants.id, s.merchantId)),
    (await getTenantDb(id)).select({ n: sql<number>`count(*)`.mapWith(Number), v: sql<number>`coalesce(sum(total_piasters),0)`.mapWith(Number) }).from(orders).where(eq(orders.storeId, id)),
    db.select().from(platformPayments).where(eq(platformPayments.storeId, id)).orderBy(desc(platformPayments.createdAt)),
    db.select().from(storeSnapshots).where(eq(storeSnapshots.storeId, id)).orderBy(desc(storeSnapshots.version)).limit(15),
    db.select().from(systemEvents).where(eq(systemEvents.storeId, id)).orderBy(desc(systemEvents.createdAt)).limit(20),
    getBlueprint(id).catch(() => null),
    // استهلاك الذكاء الاصطناعي الفعلي لهذا المتجر (تكلفة المعاينة): أعداد وتوكنز من السجل، لا أسعار مفترضة.
    db
      .select({
        purpose: aiCalls.purpose,
        calls: sql<number>`count(*)`.mapWith(Number),
        failed: sql<number>`count(*) filter (where not ${aiCalls.ok})`.mapWith(Number),
        tin: sql<number>`coalesce(sum(${aiCalls.tokensIn}),0)`.mapWith(Number),
        tout: sql<number>`coalesce(sum(${aiCalls.tokensOut}),0)`.mapWith(Number),
      })
      .from(aiCalls)
      .where(eq(aiCalls.storeId, id))
      .groupBy(aiCalls.purpose)
      .orderBy(sql`sum(${aiCalls.tokensIn} + ${aiCalls.tokensOut}) desc`),
  ]);
  const aiTotal = aiUse.reduce((a, r) => ({ calls: a.calls + r.calls, failed: a.failed + r.failed, tokens: a.tokens + r.tin + r.tout }), { calls: 0, failed: 0, tokens: 0 });

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5">
        <div>
          <Link href="/admin/stores" className="text-xs text-[#8fa8ff] hover:underline mb-2 inline-block">← العودة لدليل المتاجر</Link>
          <h1 className="text-3xl font-black text-white">{s.name}</h1>
          <p className="font-mono text-sm text-slate-400 mt-1" dir="ltr">{s.subdomain}.colapia.com</p>
        </div>
        <div className="flex gap-2">
          <a href={storeUrl(s.subdomain)} target="_blank" className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20">زيارة المتجر ↗</a>
          <a href={`${storeUrl(s.subdomain)}/admin`} target="_blank" className="rounded-xl bg-[#6f86ff] px-4 py-2 text-sm font-black text-[#07091a] hover:brightness-110">لوحة التاجر ↗</a>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <StoreAdminActions 
            store={{ id: s.id, status: s.status, subdomain: s.subdomain, customDomain: s.customDomain, showcase: s.showcaseOptIn, acceptingOrders: s.acceptingOrders }} 
            merchantActivated={!!m?.isActivated} 
            hasBlueprint={!!bp}
            currentBp={bp!}
            snapshots={snaps}
          />
          
          <div className="rounded-3xl border border-white/10 bg-[#0b0f2a] p-5">
            <h2 className="text-sm font-black text-white mb-1 border-b border-white/5 pb-2">استهلاك الذكاء الاصطناعي لهذا المتجر</h2>
            {aiUse.length ? (
              <>
                <p className="text-xs text-slate-400 mt-2">
                  {aiTotal.calls} استدعاء ({aiTotal.failed} فشل) · {aiTotal.tokens.toLocaleString("en-US")} توكن إجمالاً. قارن مع سعر موديلك لتعرف تكلفة المعاينة.
                </p>
                <table className="mt-3 w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 text-start">
                      <th className="text-start font-bold pb-1">الغرض</th>
                      <th className="text-start font-bold pb-1">استدعاءات</th>
                      <th className="text-start font-bold pb-1">توكن مدخل</th>
                      <th className="text-start font-bold pb-1">توكن مخرج</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300">
                    {aiUse.map((r) => (
                      <tr key={r.purpose}>
                        <td className="py-1.5 font-mono" dir="ltr">{r.purpose}</td>
                        <td className="py-1.5 tabular-nums">{r.calls}{r.failed ? <span className="text-rose-400"> ({r.failed} فشل)</span> : null}</td>
                        <td className="py-1.5 tabular-nums">{r.tin.toLocaleString("en-US")}</td>
                        <td className="py-1.5 tabular-nums">{r.tout.toLocaleString("en-US")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <p className="text-xs text-slate-400 mt-2">لا استدعاءات مسجلة لهذا المتجر.</p>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-3xl border border-white/10 bg-[#0b0f2a] p-5">
              <h2 className="text-sm font-black text-white mb-4 border-b border-white/5 pb-2">أداء المبيعات (GMV)</h2>
              <p className="text-3xl font-black text-emerald-400 font-mono">{formatEgp(o!.v)}</p>
              <p className="text-xs text-slate-400 mt-1">من إجمالي {o!.n} طلبات</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-[#0b0f2a] p-5">
              <h2 className="text-sm font-black text-white mb-4 border-b border-white/5 pb-2">بيانات التاجر (KYC)</h2>
              <p className="text-sm font-bold text-white">{m?.displayName}</p>
              <p className="text-xs text-slate-400 font-mono mt-1" dir="ltr">{m?.phone || "لا يوجد هاتف"}</p>
              <p className="text-[10px] text-slate-500 mt-2">آخر دخول: {fmt(m?.lastLoginAt)}</p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0b0f2a] p-5">
            <h2 className="text-sm font-black text-white mb-4 border-b border-white/5 pb-2">الخط الزمني الممتد (Timeline)</h2>
            <ul className="space-y-3 max-h-80 overflow-y-auto pr-2">
              {events.map((e) => (
                <li key={e.id} className="flex items-start gap-3 text-xs">
                  <span className="mt-1 size-2 rounded-full bg-[#8fa8ff] shrink-0" />
                  <div>
                    <p className="font-bold text-slate-200">{e.message}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{fmt(e.createdAt)} · {e.actor}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-6">
          <StoreRiskAuditCard storeId={s.id} />
          
          <div className="rounded-3xl border border-white/10 bg-[#0b0f2a] p-5">
            <h2 className="text-sm font-black text-white mb-4 border-b border-white/5 pb-2">سجل الدفعات للمنصة</h2>
            {pays.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">لم يقم التاجر بأي تحويلات بعد</p>
            ) : (
              <ul className="space-y-3">
                {pays.map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-xs border-b border-white/5 pb-2">
                    <div>
                      <p className="font-bold text-white">{formatEgp(p.amountPiasters)}</p>
                      <p className="text-[10px] text-slate-400">{p.method}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-md font-bold text-[10px] ${p.status === "confirmed" ? "bg-emerald-500/20 text-emerald-300" : p.status === "rejected" ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-300"}`}>
                      {p.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}