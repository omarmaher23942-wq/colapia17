import Link from "next/link";
import { desc, notInArray, sql, and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { conversations, stores } from "@/db/schema";
import { Users, Download, Flame, Clock, AlertTriangle, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STAGE_LABEL: Record<string, string> = { greeting: "ترحيب", discovery: "اكتشاف", persuasion: "إقناع", trial_offer: "عرض التجربة", brief: "بيانات", products: "منتجات", policies: "سياسات", summary: "ملخص", building: "بناء", delivered: "مُسلَّم", trial: "تجربة", payment: "دفع", frozen: "مجمّد", lost: "ضائع", human: "بشري" };

function heat(c: { leadScore: number; stage: string; lastUserMessageAt: Date | null }) {
  const ageH = c.lastUserMessageAt ? (Date.now() - c.lastUserMessageAt.getTime()) / 36e5 : 899;
  const stageW: Record<string, number> = { trial: 30, delivered: 30, summary: 25, policies: 20, products: 18, brief: 15, trial_offer: 12, persuasion: 8, discovery: 4, greeting: 0, frozen: 10, building: 20, payment: 35 };
  return Math.max(0, Math.min(100, Math.round(c.leadScore * 0.6 + (stageW[c.stage] ?? 0) + (ageH < 2 ? 15 : ageH < 24 ? 8 : ageH < 72 ? 0 : -15))));
}

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ sort?: string; f?: string }> }) {
  const { sort = "heat", f = "open" } = await searchParams;
  
  const where = f === "lost" ? eq(conversations.stage, "lost") : 
                f === "stale" ? and(notInArray(conversations.stage, ["activated", "lost"]), sql`${conversations.lastUserMessageAt} < now() - interval '48 hours'`) : 
                f === "all" ? undefined : notInArray(conversations.stage, ["activated", "lost"]);
  
  const rows = (await db.select({ c: conversations, storeName: stores.name, storeId: stores.id, storeStatus: stores.status }).from(conversations).leftJoin(stores, eq(stores.id, conversations.storeId)).where(where).orderBy(desc(conversations.updatedAt)).limit(400)).map((r) => ({ ...r, heat: heat(r.c) }));
  
  rows.sort((a, b) => sort === "recent" ? (b.c.lastUserMessageAt?.getTime() ?? 0) - (a.c.lastUserMessageAt?.getTime() ?? 0) : sort === "score" ? b.c.leadScore - a.c.leadScore : b.heat - a.heat);
  
  const [stats] = await db.select({ 
    total: sql<number>`count(*)`.mapWith(Number), 
    week: sql<number>`count(*) filter (where created_at > now() - interval '7 days')`.mapWith(Number), 
    won: sql<number>`count(*) filter (where stage='activated')`.mapWith(Number), 
    lost: sql<number>`count(*) filter (where stage='lost')`.mapWith(Number), 
    stale: sql<number>`count(*) filter (where stage not in ('activated','lost') and last_user_message_at < now() - interval '48 hours')`.mapWith(Number) 
  }).from(conversations);
  
  const convRate = stats!.total ? ((stats!.won / stats!.total) * 100).toFixed(1) : "0";
  const lostReasons = await db.select({ r: conversations.lostReason, c: sql<number>`count(*)`.mapWith(Number) }).from(conversations).where(eq(conversations.stage, "lost")).groupBy(conversations.lostReason).orderBy(desc(sql`count(*)`)).limit(5);
  
  const Pill = ({ k, l, cur, param, icon: Icon }: any) => (
    <Link href={`?${param}=${k}&${param === "f" ? `sort=${sort}` : `f=${f}`}`} className={cn("inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors", cur === k ? "bg-[#6f86ff] text-white shadow-md" : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10")}>
      {Icon && <Icon className="size-3.5" />} {l}
    </Link>
  );

  return (
    <div className="space-y-6 bg-[#07091a] text-[#eaf0ff]" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Users className="size-6 text-[#8fa8ff]" />
            إدارة الليدز والـ CRM
          </h1>
          <p className="mt-1 text-xs text-slate-400">تتبع العملاء المحتملين، تحليل أسباب الضياع، والتدخل في الوقت المناسب.</p>
        </div>
        <Link href="/admin/leads/export" className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white hover:bg-white/10 transition-colors">
          <Download className="size-4" /> تصدير CSV
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          { l: "كل الليدز", v: stats!.total, c: "border-white/10 bg-[#0b0f2a]" },
          { l: "جديد هذا الأسبوع", v: stats!.week, c: "border-blue-500/30 bg-blue-500/10 text-blue-400" },
          { l: "معدل التحويل", v: `${convRate}%`, c: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" },
          { l: "يحتاج متابعة (48س+)", v: stats!.stale, c: "border-amber-500/30 bg-amber-500/10 text-amber-400" },
          { l: "ضائع", v: stats!.lost, c: "border-rose-500/30 bg-rose-500/10 text-rose-400" }
        ].map((s, i) => (
          <div key={i} className={cn("rounded-2xl border p-4", s.c)}>
            <p className="text-xs font-bold opacity-80">{s.l}</p>
            <p className="mt-1 text-2xl font-black font-mono">{s.v}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4 bg-[#0b0f2a] p-3 rounded-2xl border border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400">عرض:</span>
          <Pill k="open" l="مفتوحة" cur={f} param="f" />
          <Pill k="stale" l="تحتاج متابعة" cur={f} param="f" icon={AlertTriangle} />
          <Pill k="lost" l="ضائعة" cur={f} param="f" />
          <Pill k="all" l="الكل" cur={f} param="f" />
        </div>
        <div className="w-px h-6 bg-white/10 hidden md:block" />
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400">ترتيب:</span>
          <Pill k="heat" l="الحرارة" cur={sort} param="sort" icon={Flame} />
          <Pill k="score" l="Lead Score" cur={sort} param="sort" />
          <Pill k="recent" l="الأحدث" cur={sort} param="sort" icon={Clock} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-white/10 bg-[#0e1424]">
        <table className="w-full text-xs text-start">
          <thead className="border-b border-white/10 bg-white/[0.02] text-slate-400 font-bold">
            <tr>
              <th className="p-4 text-start">العميل</th>
              <th className="p-4 text-start">القناة</th>
              <th className="p-4 text-start">المرحلة</th>
              <th className="p-4 text-start">الحرارة 🔥</th>
              <th className="p-4 text-start">النشاط</th>
              <th className="p-4 text-start">ملاحظات واعتراضات</th>
              <th className="p-4 text-start">المتجر</th>
              <th className="p-4 text-start">آخر تفاعل</th>
              <th className="p-4 text-start">إجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map(({ c, storeName, storeId, storeStatus, heat: hv }) => { 
              const m = c.memory as any; 
              const stale = c.lastUserMessageAt && Date.now() - c.lastUserMessageAt.getTime() > 48 * 36e5 && !["lost", "frozen"].includes(c.stage);
              return (
                <tr key={c.id} className={cn("transition-colors hover:bg-white/[0.03]", stale && "bg-amber-500/5")}>
                  <td className="p-4 font-bold text-white">
                    {c.profileName ?? "مستخدم"}
                    {c.botPaused && <span className="ms-1.5 rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] text-amber-300">تدخل بشري</span>}
                  </td>
                  <td className="p-4 font-mono text-slate-400">{c.channel === "instagram" ? "IG" : "FB"}</td>
                  <td className="p-4">
                    <span className="rounded-lg bg-white/10 px-2.5 py-1 font-bold text-slate-300">{STAGE_LABEL[c.stage] ?? c.stage}</span>
                    {c.lostReason && <p className="mt-1.5 text-[10px] text-rose-400 font-bold">{c.lostReason}</p>}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 overflow-hidden rounded-full bg-white/10">
                        <div className={cn("h-full rounded-full", hv >= 70 ? "bg-rose-500" : hv >= 40 ? "bg-amber-500" : "bg-teal-500")} style={{ width: `${hv}%` }} />
                      </div>
                      <span className="font-mono font-black text-white">{hv}</span>
                    </div>
                  </td>
                  <td className="p-4 text-slate-300 font-bold">{m?.industry ?? "—"}</td>
                  <td className="p-4 max-w-[200px]">
                    <p className="truncate text-amber-200 font-bold">{(m?.painPoints ?? []).slice(0, 2).join("، ") || "—"}</p>
                    {m?.notes?.length ? <p className="truncate text-slate-400 mt-1">{m.notes.slice(-2).join(" · ")}</p> : null}
                  </td>
                  <td className="p-4">
                    {storeId ? <Link href={`/admin/stores/${storeId}`} className="text-[#8fa8ff] font-bold hover:underline">{storeName} <span className="text-slate-500 font-normal">({storeStatus})</span></Link> : <span className="text-slate-500">—</span>}
                  </td>
                  <td className="p-4 text-slate-400 font-mono">
                    {c.lastUserMessageAt?.toLocaleString("ar-EG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) ?? "—"}
                    {stale && <p className="text-amber-400 font-sans font-bold mt-1 text-[10px]">يحتاج متابعة</p>}
                  </td>
                  <td className="p-4">
                    <Link href={`/admin/conversations?id=${c.id}`} className="inline-flex items-center gap-1.5 rounded-xl bg-[#6f86ff]/20 px-3 py-1.5 font-bold text-[#8fa8ff] hover:bg-[#6f86ff]/30 transition-colors">
                      <MessageSquare className="size-3.5" /> افتح
                    </Link>
                  </td>
                </tr>
              ); 
            })}
            {!rows.length && <tr><td colSpan={9} className="p-16 text-center text-slate-500 text-sm font-bold">لا توجد ليدز مطابقة للبحث</td></tr>}
          </tbody>
        </table>
      </div>

      {lostReasons.length > 0 && (
        <div className="rounded-3xl border border-rose-500/20 bg-rose-500/5 p-6">
          <h2 className="mb-4 font-black text-rose-200 flex items-center gap-2"><AlertTriangle className="size-4" /> تحليل أسباب الضياع (Lost Reasons)</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lostReasons.map((r) => (
              <div key={r.r ?? "?"} className="flex items-center justify-between bg-[#0b0f2a] border border-white/5 p-3 rounded-xl">
                <span className="text-xs font-bold text-slate-300 truncate pr-2">{r.r ?? "غير محدد"}</span>
                <span className="font-mono text-sm font-black text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-lg">{r.c}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}