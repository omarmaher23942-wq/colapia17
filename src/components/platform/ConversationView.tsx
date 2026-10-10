"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Pause, Play, Brain, Send, Sparkles, Activity, Mic, Paperclip, ArrowLeft,
  Package, Star, Image as ImageIcon, Video, MessageSquare, ClipboardList, ShieldCheck, Database, CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { togglePauseAction, humanReplyAction, summarizeLeadAction, setStageAction } from "@/server/actions/platform-conv";
import { AIReasoningPanel } from "./AIReasoningPanel";
import { SentimentBadge } from "./SentimentBadge";
import { LeadScoringCard } from "./LeadScoringCard";
import { cn } from "@/lib/utils";

const SW = 1.75;

type J = Record<string, unknown>;

type Msg = {
  id: string;
  role: string;
  text: string | null;
  atts: { type: string; url: string; utUrl?: string; transcript?: string }[];
  at: string;
  model?: string | null;
  meta?: {
    thinking?: string;
    stage?: string;
    leadScore?: number;
    quickReplies?: string[];
    extracted?: Record<string, unknown>;
    finalize?: unknown;
  } | null;
  latency?: number | null;
};

type IntakeSummary = {
  completeness: number;
  finalized: boolean;
  brief: J;
  policies: J;
  products: { name: string; price: number; bestSeller: boolean; imageUrl: string }[];
  assets: { logo: boolean; covers: number; testimonialShots: number; videos: number };
};

type Conv = {
  id: string;
  name: string;
  channel: string;
  stage: string;
  stageKey: string;
  paused: boolean;
  lead: number;
  memory: J;
  storeId: string | null;
  storeName: string | null;
  lastUserAt: string | null;
  intake?: IntakeSummary | null;
};

const CANNED = [
  "أهلاً بيك، أنا من فريق Colapia، معاك في أي حاجة.",
  "تمام، هراجع الموضوع وأرد عليك خلال دقائق.",
  "متجرك تحت المراجعة النهائية وهيوصلك الرابط قريباً جداً.",
  "لو عندك أي سؤال عن لوحة التحكم قولي وأنا أشرح لك خطوة بخطوة.",
  "الباقة تشمل متجرك وسنة استضافة كاملة، وبعدها تجديد سنوي معلن، وبدون أي عمولة على مبيعاتك. السعر الحالي في صفحة الدفع.",
];

const STAGES = ["greeting", "discovery", "persuasion", "trial_offer", "brief", "products", "proof", "policies", "summary", "human", "lost"];

const isEmpty = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length) || (typeof v === "object" && !Array.isArray(v) && !Object.keys(v as J).length);

function Value({ v }: { v: unknown }) {
  if (isEmpty(v)) return <span className="text-slate-500">لا شيء</span>;
  if (typeof v === "boolean") return <span className={v ? "text-[#8fa8ff]" : "text-slate-500"}>{v ? "نعم" : "لا"}</span>;
  if (typeof v === "number" || typeof v === "string") return <span className="break-words text-[#eaf0ff]">{String(v)}</span>;
  if (Array.isArray(v)) return <div className="flex flex-wrap gap-1">{v.map((x, i) => <span key={i} className="rounded-full border border-[#6f86ff]/30 bg-[#6f86ff]/10 px-2 py-0.5 text-[11px] text-[#c3cdf0]">{String(x)}</span>)}</div>;
  return <span className="text-[11px] text-slate-400">كائن معقد</span>;
}

function Rows({ data }: { data: J }) {
  const entries = Object.entries(data ?? {}).filter(([, v]) => !isEmpty(v));
  if (!entries.length) return <span className="text-[11px] text-slate-500">لا بيانات بعد</span>;
  return (
    <dl className="grid gap-1.5">
      {entries.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[104px_1fr] gap-2 text-[11px]">
          <dt className="truncate text-[#c3cdf0]/70" title={k}>{k}</dt>
          <dd className="min-w-0 leading-5"><Value v={v} /></dd>
        </div>
      ))}
    </dl>
  );
}

function GlassCard({ icon: Icon, title, aside, children }: any) {
  return (
    <section className="rounded-xl border border-white/10 bg-[#07091a]/50 p-3 backdrop-blur-xl">
      <header className="mb-2 flex items-center gap-2 text-xs font-bold text-[#eaf0ff]">
        <Icon className="size-3.5 text-[#8fa8ff]" strokeWidth={SW} />
        {title}
        <span className="ms-auto">{aside}</span>
      </header>
      {children}
    </section>
  );
}

export function ConversationView({ conv, msgs }: { conv: Conv; msgs: Msg[] }) {
  const [text, setText] = useState("");
  const [p, start] = useTransition();
  const [sum, setSum] = useState<string | null>(null);
  const [showThinking, setShowThinking] = useState(false);
  const [tab, setTab] = useState<"chat" | "data" | "crm">("chat");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tab === "chat") end.current?.scrollIntoView({ block: "end" });
  }, [msgs.length, tab]);

  const inWindow = conv.lastUserAt ? Date.now() - new Date(conv.lastUserAt).getTime() < 23.5 * 36e5 : false;

  const send = () => {
    if (!text.trim()) return;
    start(async () => {
      const r = await humanReplyAction(conv.id, text);
      if (r?.error) toast.error(r.error);
      else {
        setText("");
        toast.success("أُرسلت وتم إيقاف المساعد");
      }
    });
  };

  const BTN = "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-40";
  const GHOST = `${BTN} border-white/10 bg-white/[.04] text-[#c3cdf0] hover:bg-white/10 hover:text-[#eaf0ff]`;
  const SILVER = `${BTN} border-transparent bg-gradient-to-b from-[#eaf0ff] to-[#c3cdf0] text-[#07091a]`;
  const AMBER = `${BTN} border-amber-400/40 bg-amber-400/20 text-amber-100 hover:bg-amber-400/30`;
  const VIOLET = `${BTN} border-[#6f86ff]/40 bg-[#6f86ff]/25 text-[#eaf0ff]`;

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0b0f2a] shadow-2xl">
      <header className="flex flex-wrap items-center gap-3 border-b border-white/10 p-4 bg-[#07091a]/50">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-[#6f86ff]/15 text-[#8fa8ff] font-black text-lg">
            {conv.name.charAt(0)}
          </div>
          <div>
            <b className="text-sm text-[#eaf0ff] block">{conv.name}</b>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">{conv.channel}</span>
              <SentimentBadge score={conv.lead} text={msgs[msgs.length - 1]?.text ?? ""} />
            </div>
          </div>
        </div>

        <div className="ms-auto flex flex-wrap gap-2">
          <button onClick={() => setTab("chat")} className={tab === "chat" ? VIOLET : GHOST}>
            <MessageSquare className="size-3.5" /> المحادثة
          </button>
          <button onClick={() => setTab("data")} className={tab === "data" ? VIOLET : GHOST}>
            <Database className="size-3.5" /> البيانات
          </button>
          <button onClick={() => setTab("crm")} className={tab === "crm" ? VIOLET : GHOST}>
            <Activity className="size-3.5" /> CRM
          </button>
          <button disabled={p} onClick={() => start(async () => setSum(await summarizeLeadAction(conv.id)))} className={GHOST}>
            <Sparkles className="size-3.5" /> ملخص
          </button>
          <button disabled={p} onClick={() => start(() => togglePauseAction(conv.id, !conv.paused))} className={conv.paused ? SILVER : AMBER}>
            {conv.paused ? <><Play className="size-3.5" /> تشغيل الـ AI</> : <><Pause className="size-3.5" /> إيقاف الـ AI</>}
          </button>
        </div>
      </header>

      {sum && (
        <div className="border-b border-[#8fa8ff]/30 bg-[#6f86ff]/10 p-4 text-xs leading-relaxed text-[#eaf0ff] flex items-start gap-2">
          <Sparkles className="size-4 text-[#8fa8ff] shrink-0 mt-0.5" />
          <p>{sum}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 bg-[#07091a]/30">
        {tab === "crm" && (
          <div className="max-w-md mx-auto space-y-4">
            <LeadScoringCard score={conv.lead} stage={conv.stage} phone={conv.memory?.phone as string} />
            <GlassCard icon={ShieldCheck} title="تغيير المرحلة يدوياً">
              <select
                value={conv.stageKey}
                onChange={(e) => start(() => setStageAction(conv.id, e.target.value))}
                className="w-full rounded-xl border border-white/10 bg-[#07091a] p-3 text-xs text-white outline-none focus:border-[#8fa8ff]"
              >
                {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </GlassCard>
          </div>
        )}

        {tab === "data" && (
          <div className="space-y-4">
            <GlassCard icon={Brain} title="الذاكرة التراكمية (Memory)">
              <Rows data={conv.memory} />
            </GlassCard>
            {conv.intake ? (
              <GlassCard icon={ClipboardList} title="بيانات الاستمارة المستخرجة">
                <Rows data={conv.intake.brief} />
              </GlassCard>
            ) : (
              <p className="text-center text-xs text-slate-500 py-8">لم يتم استخراج بيانات استمارة بعد</p>
            )}
          </div>
        )}

        {tab === "chat" && (
          <div className="space-y-4">
            <div className="flex justify-center mb-4">
              <button onClick={() => setShowThinking(!showThinking)} className="text-[10px] font-bold text-[#8d97c4] hover:text-white transition-colors flex items-center gap-1 bg-white/5 px-3 py-1 rounded-full">
                <Brain className="size-3" /> {showThinking ? "إخفاء تفكير الـ AI" : "إظهار تفكير الـ AI"}
              </button>
            </div>
            
            {msgs.map((m) => {
              const isUser = m.role === "user";
              const isHumanAgent = m.role === "human_agent";
              return (
                <div key={m.id} className={`flex ${isUser ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                    isUser ? "bg-white/5 text-[#eaf0ff] border border-white/10 rounded-tr-sm" : 
                    isHumanAgent ? "bg-amber-500/10 text-amber-50 border border-amber-500/30 rounded-tl-sm" : 
                    "bg-[#6f86ff]/15 text-[#eaf0ff] border border-[#6f86ff]/30 rounded-tl-sm"
                  }`}>
                    {m.text && <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>}

                    {m.atts?.map((a, i) =>
                      a.type === "image" ? (
                        <a key={i} href={a.utUrl ?? a.url} target="_blank" rel="noopener">
                          <img src={a.utUrl ?? a.url} alt="" className="mt-2 max-h-48 rounded-xl border border-white/10" />
                        </a>
                      ) : a.type === "audio" ? (
                        <p key={i} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs italic text-[#c3cdf0]">
                          <Mic className="size-3.5 text-[#8fa8ff]" /> {a.transcript || "رسالة صوتية"}
                        </p>
                      ) : null
                    )}

                    {showThinking && !isUser && !isHumanAgent && m.meta && (
                      <AIReasoningPanel meta={m.meta as any} />
                    )}

                    <div className="mt-2 flex items-center justify-end gap-2 text-[9px] text-slate-400 font-mono">
                      {isHumanAgent && <span className="text-amber-300 font-sans font-bold">تدخل بشري ({m.model})</span>}
                      {!isUser && !isHumanAgent && m.model && <span>{m.model} {m.latency ? `(${Math.round(m.latency/1000)}s)` : ""}</span>}
                      <span>{new Date(m.at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={end} />
          </div>
        )}
      </div>

      {tab === "chat" && (
        <div className="border-t border-white/10 bg-[#0b0f2a] p-4">
          <div className="mb-3 flex gap-2 overflow-x-auto hide-scrollbar pb-1">
            {CANNED.map((c) => (
              <button
                key={c}
                onClick={() => setText(c)}
                className="shrink-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-bold text-[#c3cdf0] hover:bg-white/10 hover:text-white transition-colors"
              >
                {c.slice(0, 40)}...
              </button>
            ))}
          </div>
          <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <textarea
              rows={1}
              className="flex-1 min-h-[44px] max-h-32 resize-none rounded-xl border border-white/10 bg-[#07091a] px-4 py-3 text-sm text-[#eaf0ff] outline-none placeholder:text-slate-500 focus:border-[#8fa8ff] transition-colors"
              placeholder={conv.paused ? "اكتب ردك كإنسان..." : "الإرسال يوقف المساعد الذكي تلقائياً..."}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            <button
              disabled={p || !text.trim()}
              className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-l from-[#6f86ff] to-[#8fa8ff] text-[#07091a] shadow-md transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
            >
              <Send className="size-4.5" strokeWidth={2} />
            </button>
          </form>
          {!inWindow && conv.channel === "messenger" && (
            <p className="mt-2 text-[10px] text-amber-400 flex items-center gap-1">
              <AlertTriangle className="size-3" />
              خارج نافذة 24 ساعة: سيُرسل بـ tag ACCOUNT_UPDATE.
            </p>
          )}
        </div>
      )}
    </section>
  );
}