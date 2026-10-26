import Link from "next/link";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { Flame, MessagesSquare, Search, Bot, User, PackageCheck, Briefcase } from "lucide-react";
import { db } from "@/db/client";
import { conversations, merchants, messages, stores } from "@/db/schema";
import { handoffColumns, handoffFromRow } from "@/agent/handoff-data";
import { HANDOFF_KINDS, HANDOFF_TITLE, handoffMessage } from "@/agent/handoff-messages";
import { pauseLabel, pauseState } from "@/agent/pause";
import type { Lead } from "@/agent/lead";
import { OTHER_SERVICE_FLAG, isOtherService } from "@/agent/other-service";
import { BUILD_REQUEST_FLAG } from "@/agent/build-request";
import { ConversationView } from "@/components/platform/ConversationView";
import { AutoRefresh } from "@/components/platform/AutoRefresh";
import { requirePlatformPage } from "@/server/platform-guard";

export const dynamic = "force-dynamic";

const SW = 1.75;

const STAGE_LABEL: Record<string, string> = {
  greeting: "ترحيب", discovery: "اكتشاف", persuasion: "إقناع", trial_offer: "عرض التجربة",
  brief: "بيانات", products: "المنتجات", proof: "البرهان", policies: "السياسات",
  summary: "ملخص", handoff: "تسليم", building: "قيد الإعداد", link_sent: "أُرسل الرابط", delivered: "مُسلَّم",
  trial: "تجربة", payment: "دفع", activated: "مفعّل", frozen: "مجمّد", lost: "ضائع", human: "بشري",
};

// «other_service» ليست مرحلة: علامة في ذاكرة المحادثة يضعها الوكيل حين يطلب العميل خدمة غير المتجر.
const FILTERS = ["", BUILD_REQUEST_FLAG, "other_service", "human", "handoff", "persuasion", "building", "link_sent", "trial", "lost"];
const FILTER_LABEL: Record<string, string> = { other_service: "خدمة أخرى", [BUILD_REQUEST_FLAG]: "طلب بناء جديد" };
const flagFilter = (stage: string) => (stage === OTHER_SERVICE_FLAG || stage === BUILD_REQUEST_FLAG ? sql`${conversations.memory}->>'flag' = ${stage}` : undefined);

const FIELD_ROWS: { key: keyof Lead; label: string }[] = [
  { key: "niche", label: "النشاط" },
  { key: "storeName", label: "اسم المتجر" },
  { key: "email", label: "البريد" },
  { key: "whatsapp", label: "واتساب" },
  { key: "instagram", label: "إنستجرام" },
  { key: "styleNotes", label: "ميوله في التصميم" },
];

/** ما جمعه الوكيل بالترتيب الثابت. */
function collectedRows(memory: unknown, channel: string): { label: string; value: string | null }[] {
  const lead = ((memory as { lead?: Lead } | null)?.lead ?? {}) as Lead;
  const rows = FIELD_ROWS.map((f) => ({ label: f.label, value: typeof lead[f.key] === "string" ? (f.key === "instagram" ? `@${lead.instagram}` : (lead[f.key] as string)) : null }));
  return channel === "instagram" ? rows : rows.filter((r) => r.label !== "إنستجرام" || r.value);
}

function attributionText(memory: unknown): string | null {
  const a = (memory as { attribution?: { first?: { source?: string; type?: string; adId?: string; adTitle?: string; ref?: string } } } | null)?.attribution?.first;
  if (!a) return null;
  return [a.adTitle, a.adId && `إعلان ${a.adId}`, a.source, a.type, a.ref].filter(Boolean).join(" · ") || null;
}

export default async function ConversationsPage({ searchParams }: { searchParams: Promise<{ id?: string; stage?: string; q?: string }> }) {
  await requirePlatformPage({ cap: "conversations" });
  const { id, stage = "", q = "" } = await searchParams;

  const list = await db
    .select({ c: conversations, storeName: stores.name, storeStatus: stores.status })
    .from(conversations)
    .leftJoin(stores, eq(stores.id, conversations.storeId))
    .where(stage ? (flagFilter(stage) ?? eq(conversations.stage, stage as any)) : undefined)
    .orderBy(desc(conversations.updatedAt))
    .limit(150);

  const filtered = q ? list.filter((x) => (x.c.profileName ?? "").includes(q) || (x.storeName ?? "").includes(q)) : list;
  const active = id ? filtered.find((x) => x.c.id === id) ?? list.find((x) => x.c.id === id) : filtered[0];

  const [msgs, storeRow, stats, waiting] = await Promise.all([
    active ? db.select().from(messages).where(eq(messages.conversationId, active.c.id)).orderBy(messages.createdAt).limit(400) : Promise.resolve([]),
    active?.c.storeId
      ? db.select(handoffColumns).from(stores).leftJoin(merchants, eq(merchants.id, stores.merchantId)).where(eq(stores.id, active.c.storeId)).limit(1).then((r) => r[0] ?? null)
      : Promise.resolve(null),
    db.select({
      total: sql<number>`count(*)`.mapWith(Number),
      hot: sql<number>`count(*) filter (where lead_score >= 70)`.mapWith(Number),
      human: sql<number>`count(*) filter (where stage = 'human' and bot_paused and coalesce(memory->>'flag', '') <> 'other_service')`.mapWith(Number),
      other: sql<number>`count(*) filter (where memory->>'flag' = 'other_service')`.mapWith(Number),
      build: sql<number>`count(*) filter (where memory->>'flag' = 'build_request')`.mapWith(Number),
    }).from(conversations),
    // متاجر أنشأها الوكيل ولم يُسلَّم رابط إعدادها بعد.
    db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(stores)
      .where(and(eq(stores.status, "setup"), isNotNull(stores.sourceConversationId), sql`${stores.onboarding}->>'linkSentAt' is null`))
      .then((r) => r[0]?.n ?? 0)
      .catch(() => 0),
  ]);
  const handoff = storeRow ? handoffFromRow(storeRow) : null;
  const activeMemory = (active?.c.memory ?? {}) as { closedBy?: unknown; speaker?: unknown };

  if (active?.c.unreadForAdmin) {
    await db.update(conversations).set({ unreadForAdmin: 0 }).where(eq(conversations.id, active.c.id));
  }

  const ago = (d: Date | null) => {
    if (!d) return "";
    const m = Math.round((Date.now() - d.getTime()) / 6e4);
    return m < 60 ? `${m} د` : m < 1440 ? `${Math.round(m / 60)} س` : `${Math.round(m / 1440)} ي`;
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-6rem)] space-y-4" dir="rtl">
      <AutoRefresh everyMs={12000} />

      <div className="flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <MessagesSquare className="size-6 text-[#8fa8ff]" />
            المحادثات الحية
          </h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/conversations/delivery" className="flex items-center gap-2 rounded-xl border border-[#8fa8ff]/30 bg-[#6f86ff]/10 px-4 py-2 text-center hover:bg-[#6f86ff]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff]/60">
            <PackageCheck className="size-4 text-[#8fa8ff]" aria-hidden="true" />
            <span>
              <span className="block text-[10px] font-bold text-[#c3cdf0]">بانتظار التسليم</span>
              <span className="block text-lg font-black text-white">{waiting}</span>
            </span>
          </Link>
          <div className="bg-[#0b0f2a] border border-white/10 rounded-xl px-4 py-2 text-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase">إجمالي</p>
            <p className="text-lg font-black text-white">{stats[0]?.total}</p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2 text-center">
            <p className="text-[10px] text-amber-400 font-bold uppercase">ساخنة 🔥</p>
            <p className="text-lg font-black text-amber-300">{stats[0]?.hot}</p>
          </div>
          <Link href={`/admin/conversations?stage=${BUILD_REQUEST_FLAG}`} className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-2 text-center hover:bg-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60">
            <p className="text-[10px] text-emerald-300 font-bold">طلب بناء جديد</p>
            <p className="text-lg font-black text-emerald-200">{stats[0]?.build ?? 0}</p>
          </Link>
          <Link href={`/admin/conversations?stage=${OTHER_SERVICE_FLAG}`} className="bg-violet-500/10 border border-violet-500/30 rounded-xl px-4 py-2 text-center hover:bg-violet-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60">
            <p className="text-[10px] text-violet-300 font-bold">خدمة أخرى</p>
            <p className="text-lg font-black text-violet-200">{stats[0]?.other ?? 0}</p>
          </Link>
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
                  {s ? FILTER_LABEL[s] ?? STAGE_LABEL[s] : "الكل"}
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
                  {(c.memory as { flag?: unknown } | null)?.flag === BUILD_REQUEST_FLAG && (
                    <span className="flex items-center gap-1 rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-emerald-200">
                      <PackageCheck className="size-3" aria-hidden="true" />
                      طلب بناء جديد
                    </span>
                  )}
                  {isOtherService(c.memory) && (
                    <span className="flex items-center gap-1 rounded-md bg-violet-500/20 px-1.5 py-0.5 text-violet-200">
                      <Briefcase className="size-3" aria-hidden="true" />
                      خدمة أخرى
                    </span>
                  )}
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
              paused: pauseState(active.c) === "paused", pauseText: pauseLabel(active.c), lead: active.c.leadScore, memory: active.c.memory,
              storeId: active.c.storeId, storeName: active.storeName, lastUserAt: active.c.lastUserMessageAt?.toISOString() ?? null,
              collected: collectedRows(active.c.memory, active.c.channel),
              attribution: attributionText(active.c.memory),
              store: handoff && storeRow ? { id: storeRow.id, name: storeRow.name, status: storeRow.status, subdomain: storeRow.subdomain, linkSentAt: handoff.linkSentAt } : null,
              handoff:
                handoff && storeRow
                  ? {
                      storeId: storeRow.id,
                      storeName: storeRow.name,
                      storeStatus: storeRow.status,
                      storeUrl: handoff.storeUrl,
                      linkSentAt: handoff.linkSentAt,
                      closedByAgent: activeMemory.closedBy === "agent_done",
                      messages: HANDOFF_KINDS.map((k) => ({ kind: k, title: HANDOFF_TITLE[k], text: handoffMessage(k, handoff) })),
                    }
                  : null,
              speaker: activeMemory.speaker === "owner" || activeMemory.speaker === "moderator" ? activeMemory.speaker : null,
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