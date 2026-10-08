import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { Flame, MessagesSquare, Search, Filter, Bot, User } from "lucide-react";
import { db } from "@/db/client";
import { conversations, messages, stores, intakes } from "@/db/schema";
import { ConversationView } from "@/components/platform/ConversationView";
import { AutoRefresh } from "@/components/platform/AutoRefresh";

export const dynamic = "force-dynamic";

const SW = 1.75;

const STAGE_LABEL: Record<string, string> = {
  greeting: "ترحيب", discovery: "اكتشاف", persuasion: "إقناع", trial_offer: "عرض التجربة",
  brief: "بيانات", products: "المنتجات", proof: "البرهان", policies: "السياسات",
  summary: "ملخص", handoff: "تسليم", building: "بناء", delivered: "مُسلَّم",
  trial: "تجربة", payment: "دفع", activated: "مفعّل", frozen: "مجمّد", lost: "ضائع", human: "بشري",
};

const FILTERS = ["", "human", "persuasion", "products", "proof", "building", "trial", "lost"];

export default async function ConversationsPage({ searchParams }: { searchParams: Promise<{ id?: string; stage?: string; q?: string }> }) {
  const { id, stage = "", q = "" } = await searchParams;

  const list = await db
    .select({ c: conversations, storeName: stores.name, storeStatus: stores.status })
    .from(conversations)
    .leftJoin(stores, eq(stores.id, conversations.storeId))
    .where(stage ? eq(conversations.stage, stage as any) : undefined)
    .orderBy(desc(conversations.updatedAt))
    .limit(150);

  const filtered = q ? list.filter((x) => (x.c.profileName ?? "").includes(q) || (x.storeName ?? "").includes(q)) : list;
  const active = id ? filtered.find((x) => x.c.id === id) ?? list.find((x) => x.c.id === id) : filtered[0];

  const [msgs, intakeRow, stats] = await Promise.all([
    active ? db.select().from(messages).where(eq(messages.conversationId, active.c.id)).orderBy(messages.createdAt).limit(400) : Promise.resolve([]),
    active ? db.select().from(intakes).where(eq(intakes.conversationId, active.c.id)).limit(1).then((r) => r[0] ?? null) : Promise.resolve(null),
    db.select({
      total: sql<number>`count(*)`.mapWith(Number),
      hot: sql<number>`count(*) filter (where lead_score >= 70)`.mapWith(Number),
      human: sql<number>`count(*) filter (where stage = 'human')`.mapWith(Number),
    }).from(conversations)
  ]);

  if (active?.c.unreadForAdmin) {
    await db.update(conversations).set({ unreadForAdmin: 0 }).where(eq(conversations.id, active.c.id));
  }

  const ago = (d: Date | null) => {
    if (!d) return "";
    const m = Math.round((Date.now() - d.getTime()) / 6e4);
    return m < 60 ? `${m} د` : m < 1440 ? `${Math.round(m / 60)} س` : `${Math.round(m / 1440)} ي`;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] space-y-4" dir="rtl">
      <AutoRefresh everyMs={12000} />

      <div className="flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <MessagesSquare className="size-6 text-[#8fa8ff]" />
            المحادثات الحية
          </h1>
        </div>
        <div className="flex gap-3">
          <div className="bg-[#0b0f2a] border border-white/10 rounded-xl px-4 py-2 text-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase">إجمالي</p>
            <p className="text-lg font-black text-white">{stats[0]?.total}</p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2 text-center">
            <p className="text-[10px] text-amber-400 font-bold uppercase">ساخنة 🔥</p>
            <p className="text-lg font-black text-amber-300">{stats[0]?.hot}</p>
          </div>
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-2 text-center">
            <p className="text-[10px] text-rose-400 font-bold uppercase">تدخل بشري</p>
            <p className="text-lg font-black text-rose-300">{stats[0]?.human}</p>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[380px_1fr]">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0b0f2a] shadow-xl">
          <div className="p-3 border-b border-white/10 space-y-3">
            <form className="relative">
              <Search className="absolute end-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <input name="q" defaultValue={q} placeholder="بحث بالاسم أو المتجر..." className="w-full rounded-xl border border-white/10 bg-[#07091a] px-3 pe-9 py-2.5 text-xs text-white outline-none focus:border-[#8fa8ff]" />
              <input type="hidden" name="stage" value={stage} />
            </form>
            <div className="flex gap-1.5 overflow-x-auto hide-scrollbar pb-1">
              {FILTERS.map((s) => (
                <Link key={s} href={`/admin/conversations?stage=${s}`} className={`shrink-0 rounded-lg border px-3 py-1.5 text-[11px] font-bold transition-colors ${stage === s ? "border-[#8fa8ff] bg-[#6f86ff]/20 text-white" : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"}`}>
                  {s ? STAGE_LABEL[s] : "الكل"}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filtered.map(({ c, storeName }) => (
              <Link key={c.id} href={`/admin/conversations?id=${c.id}&stage=${stage}&q=${q}`} className={`block rounded-xl p-3 transition-colors ${active?.c.id === c.id ? "bg-[#6f86ff]/15 border border-[#8fa8ff]/30" : "hover:bg-white/5 border border-transparent"}`}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="truncate text-sm font-black text-white flex items-center gap-1.5">
                    {c.botPaused ? <User className="size-3.5 text-amber-400" /> : <Bot className="size-3.5 text-[#8fa8ff]" />}
                    {c.profileName ?? "مستخدم"}
                  </span>
                  <span className="shrink-0 text-[10px] text-slate-500 font-mono">{ago(c.lastUserMessageAt)}</span>
                </div>
                <div className="flex items-center gap-2 text-[10.5px] font-bold">
                  <span className={`rounded-md px-1.5 py-0.5 ${c.stage === "human" ? "bg-amber-500/20 text-amber-300" : "bg-white/10 text-slate-300"}`}>
                    {STAGE_LABEL[c.stage] ?? c.stage}
                  </span>
                  {storeName && <span className="truncate text-[#8fa8ff]">{storeName}</span>}
                  <span className="ms-auto flex items-center gap-0.5 text-amber-400 font-mono">
                    <Flame className="size-3" /> {c.leadScore}
                  </span>
                  {c.unreadForAdmin > 0 && (
                    <span className="rounded-full bg-rose-500 px-1.5 text-white shadow-sm">{c.unreadForAdmin}</span>
                  )}
                </div>
              </Link>
            ))}
            {!filtered.length && <p className="p-8 text-center text-xs text-slate-500">لا توجد محادثات مطابقة</p>}
          </div>
        </aside>

        {active ? (
          <ConversationView
            key={active.c.id}
            conv={{
              id: active.c.id, name: active.c.profileName ?? "مستخدم", channel: active.c.channel,
              stage: STAGE_LABEL[active.c.stage] ?? active.c.stage, stageKey: active.c.stage,
              paused: active.c.botPaused, lead: active.c.leadScore, memory: active.c.memory,
              storeId: active.c.storeId, storeName: active.storeName, lastUserAt: active.c.lastUserMessageAt?.toISOString() ?? null,
              intake: intakeRow as any,
            }}
            msgs={msgs.map((m) => ({
              id: m.id, role: m.role, text: m.text, atts: m.attachments, at: m.createdAt.toISOString(),
              model: m.model, meta: m.toolCalls?.[0] as any, latency: m.latencyMs,
            }))}
          />
        ) : (
          <div className="grid place-items-center rounded-3xl border border-white/10 bg-[#0b0f2a] text-slate-500 shadow-xl">
            <div className="text-center space-y-3">
              <MessagesSquare className="mx-auto size-12 opacity-20" strokeWidth={SW} />
              <p className="text-sm font-bold">اختر محادثة من القائمة للبدء</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}