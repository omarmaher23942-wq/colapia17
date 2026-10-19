"use client";

// DesignChat — «اكتبوا ما تريدون تغييره»: وصف حر لأي تعديل في شكل المتجر ومحتواه ← معاينة «قبل/بعد» وقائمة بما سيتغير
// ← «تطبيق» يحفظ ويحدّث معاينة المتجر ← «تراجع» بضغطة، وسجل آخر 10 تعديلات للعودة إلى ما قبل أي منها.
// نفس المكوّن في الإعداد (لمسات الشكل) وفي صفحة «شكل المتجر».
import { useCallback, useEffect, useId, useState, type CSSProperties } from "react";
import { Check, History, RotateCcw, Sparkles, Undo2, X } from "lucide-react";
import { applyDesignEditAction, designEditHistoryAction, proposeDesignEditAction, undoDesignEditAction } from "@/server/actions/design-edit";
import type { DesignOp, PreviewTokens } from "@/lib/design-tweak";
import type { DesignHistoryItem } from "@/server/design-tweak";
import { btnGhost, btnPrimary, Notice, Spinner } from "@/components/onboarding/ui";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "اجعلوا الخلفية بيضاء",
  "الأزرار سوداء ومدوّرة",
  "كبّروا الخط قليلاً",
  "خط أنيق للعناوين",
  "مسافات أوسع بين العناصر",
  "أخفوا الأسئلة الشائعة",
];

type Proposal = { text: string; ops: DesignOp[]; changes: string[]; warnings: string[]; rejected: string[]; summary: string; before: PreviewTokens; after: PreviewTokens };
type Done = { summary: string; undoVersion: number | null };

export function DesignChat({ onChanged, disabled = false, headingLevel = 2 }: { onChanged: () => void; disabled?: boolean; headingLevel?: 2 | 3 }) {
  const ids = useId();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"propose" | "apply" | "undo" | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [info, setInfo] = useState<{ tone: "ok" | "warn" | "bad"; text: string } | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [history, setHistory] = useState<DesignHistoryItem[] | null>(null);
  const [view, setView] = useState<"after" | "before">("after");
  const H = headingLevel === 2 ? "h2" : "h3";

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await designEditHistoryAction());
    } catch {
      setHistory([]);
    }
  }, []);
  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  async function propose(t = text) {
    const req = t.trim();
    if (req.length < 3 || busy) return;
    setText(req);
    setBusy("propose");
    setInfo(null);
    setDone(null);
    setProposal(null);
    try {
      const r = await proposeDesignEditAction({ text: req });
      if (!r.ok) return setInfo({ tone: "bad", text: r.error });
      if (!r.ops.length) return setInfo({ tone: "warn", text: r.summary });
      setView("after");
      setProposal({ text: req, ops: r.ops, changes: r.changes, warnings: r.warnings, rejected: r.rejected, summary: r.summary, before: r.before, after: r.after });
    } catch {
      setInfo({ tone: "bad", text: "تعذر الاتصال. تأكدوا من الإنترنت وحاولوا مرة أخرى." });
    } finally {
      setBusy(null);
    }
  }

  async function apply() {
    if (!proposal || busy) return;
    setBusy("apply");
    try {
      const r = await applyDesignEditAction({ text: proposal.text, ops: proposal.ops });
      if (!r.ok) return setInfo({ tone: "bad", text: r.error });
      setDone({ summary: r.summary, undoVersion: r.undoVersion });
      setProposal(null);
      setText("");
      onChanged();
      void loadHistory();
    } catch {
      setInfo({ tone: "bad", text: "تعذر الحفظ. حاولوا مرة أخرى." });
    } finally {
      setBusy(null);
    }
  }

  async function undo(version: number, fromHistory = false) {
    if (busy) return;
    setBusy("undo");
    try {
      const r = await undoDesignEditAction({ version });
      if (!r.ok) return setInfo({ tone: "bad", text: r.error });
      setDone(null);
      setInfo({ tone: "ok", text: fromHistory ? "أعدنا المتجر إلى ما قبل هذا التعديل. ويمكن التراجع عن ذلك من سجل النسخ." : "تراجعنا عن التعديل وعاد المتجر كما كان." });
      onChanged();
      void loadHistory();
    } catch {
      setInfo({ tone: "bad", text: "تعذر التراجع. حاولوا مرة أخرى." });
    } finally {
      setBusy(null);
    }
  }

  const locked = disabled || busy !== null;

  return (
    <section aria-labelledby={`${ids}-h`} className="space-y-3">
      <div>
        <H id={`${ids}-h`} className="text-[15px] font-black text-ink">
          اكتبوا ما تريدون تغييره
        </H>
        <p className="text-[12.5px] leading-6 text-ink-3">الألوان والخلفية والخطوط والأزرار والبطاقات والأقسام والنصوص. نعرض لكم الشكل قبل التعديل وبعده، ولا يُحفظ شيء إلا بعد موافقتكم.</p>
      </div>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void propose();
        }}
      >
        <label htmlFor={`${ids}-t`} className="sr-only">
          التعديل المطلوب
        </label>
        <textarea
          id={`${ids}-t`}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 600))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void propose();
            }
          }}
          rows={3}
          disabled={locked}
          maxLength={600}
          placeholder="مثال: اجعلوا الخلفية كريمية والأزرار كحلية، وكبّروا الخط قليلاً"
          className="w-full resize-y rounded-xl border border-edge/10 bg-edge/[0.03] p-3.5 text-[14px] leading-7 text-ink outline-none transition-colors placeholder:text-ink-3/70 focus:border-nova/60 focus:ring-2 focus:ring-nova/20 disabled:opacity-60"
        />
        <ul className="flex flex-wrap gap-1.5" aria-label="أمثلة سريعة">
          {SUGGESTIONS.map((s) => (
            <li key={s}>
              <button
                type="button"
                disabled={locked}
                onClick={() => void propose(s)}
                className="min-h-9 rounded-full border border-edge/15 px-3 text-[12px] font-bold text-ink-2 transition hover:border-nova/50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50 disabled:opacity-50"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
        <button type="submit" disabled={locked || text.trim().length < 3} className={btnPrimary}>
          {busy === "propose" ? <Spinner /> : <Sparkles className="size-4" aria-hidden="true" />}
          {busy === "propose" ? "جارٍ التحضير…" : "عرض التعديل"}
        </button>
      </form>

      <div aria-live="polite" className="space-y-3">
        {info ? <Notice tone={info.tone}>{info.text}</Notice> : null}

        {done ? (
          <Notice tone="ok">
            <p>طبّقنا التعديل: {done.summary}</p>
            {done.undoVersion ? (
              <button type="button" onClick={() => void undo(done.undoVersion!)} disabled={locked} className={cn(btnGhost, "mt-2 min-h-10 border-current/30 text-current")}>
                {busy === "undo" ? <Spinner /> : <Undo2 className="size-4" aria-hidden="true" />}
                تراجع
              </button>
            ) : null}
          </Notice>
        ) : null}

        {proposal ? (
          <div className="space-y-3 rounded-2xl border border-edge/12 bg-edge/[0.03] p-3.5">
            <p className="text-[13px] font-black text-ink">سيتغيّر ما يلي:</p>
            <ul className="space-y-1.5">
              {proposal.changes.map((c) => (
                <li key={c} className="flex items-start gap-2 text-[12.5px] leading-6 text-ink-2">
                  <Check className="mt-1 size-3.5 shrink-0 text-ok" aria-hidden="true" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
            {proposal.warnings.length ? <Notice tone="warn">{proposal.warnings.join(". ")}.</Notice> : null}
            {proposal.rejected.length ? <p className="text-[11.5px] leading-5 text-ink-3">لم يُنفَّذ: {proposal.rejected.join("، ")}.</p> : null}

            <div className="flex gap-1 rounded-xl bg-edge/[0.05] p-1 sm:hidden" role="group" aria-label="المعاينة">
              {(["before", "after"] as const).map((v) => (
                <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={cn("min-h-9 flex-1 rounded-lg text-[12px] font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50", view === v ? "bg-ink text-space" : "text-ink-3")}>
                  {v === "before" ? "قبل" : "بعد"}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <MiniPreview tokens={proposal.before} caption="قبل" className={view === "before" ? "" : "hidden sm:block"} />
              <MiniPreview tokens={proposal.after} caption="بعد" className={view === "after" ? "" : "hidden sm:block"} />
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void apply()} disabled={locked} className={btnPrimary}>
                {busy === "apply" ? <Spinner /> : <Check className="size-4" aria-hidden="true" />}
                تطبيق التعديل
              </button>
              <button type="button" onClick={() => setProposal(null)} disabled={locked} className={btnGhost}>
                <X className="size-4" aria-hidden="true" />
                إلغاء
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {history && history.length ? (
        <details className="group rounded-xl border border-edge/10">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-[12.5px] font-black text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50">
            <History className="size-4 text-ink-3" aria-hidden="true" />
            آخر التعديلات بالوصف ({history.length})
          </summary>
          <ul className="divide-y divide-edge/10 border-t border-edge/10">
            {history.map((h) => (
              <li key={h.version} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-bold text-ink">{h.label}</p>
                  <p className="text-[11.5px] text-ink-3">{new Date(h.at).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short", numberingSystem: "latn" })}</p>
                </div>
                <button type="button" className={cn(btnGhost, "min-h-10 shrink-0 px-3 text-[12px]")} disabled={locked} onClick={() => void undo(h.version, true)} aria-label={`العودة إلى ما قبل: ${h.label}`}>
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                  ما قبله
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

/** معاينة مصغّرة لشكل المتجر من ألوانه وخطوطه وزواياه (زخرفية؛ قائمة التغييرات النصية هي الوصف المقروء). */
function MiniPreview({ tokens: t, caption, className }: { tokens: PreviewTokens; caption: string; className?: string }) {
  const btn: CSSProperties =
    t.buttonFill === "outline"
      ? { background: "transparent", color: t.text, border: `1.5px solid ${t.text}` }
      : t.buttonFill === "soft"
        ? { background: `color-mix(in srgb, ${t.primary} 16%, ${t.background})`, color: t.primary }
        : t.buttonFill === "gradient"
          ? { background: `linear-gradient(135deg, ${t.primary}, ${t.accent})`, color: t.primaryText }
          : t.buttonFill === "glass"
            ? { background: `color-mix(in srgb, ${t.primary} 70%, transparent)`, color: t.primaryText, backdropFilter: "blur(6px)" }
            : { background: t.primary, color: t.primaryText };
  const scale = t.baseSize / 16;
  return (
    <figure className={cn("m-0 space-y-1.5", className)}>
      <figcaption className="text-[11.5px] font-black text-ink-3">{caption}</figcaption>
      <div aria-hidden="true" className="overflow-hidden rounded-xl border border-edge/15 shadow-sm" style={{ background: t.background, color: t.text, fontFamily: t.fontBody, fontSize: 11 * scale }}>
        {t.announcement ? (
          <div className="truncate px-2 py-1 text-center" style={{ background: t.primary, color: t.primaryText, fontSize: 9 * scale }}>
            {t.announcement}
          </div>
        ) : null}
        <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${t.border}` }}>
          <span className="truncate font-black" style={{ fontFamily: t.fontHeading, fontSize: 12 * scale }}>
            {t.brand}
          </span>
          <span className="flex gap-1">
            <span className="size-2 rounded-full" style={{ background: t.mutedText, opacity: 0.6 }} />
            <span className="size-2 rounded-full" style={{ background: t.mutedText, opacity: 0.6 }} />
          </span>
        </div>
        <div className="space-y-2 px-3 py-3">
          <p className="line-clamp-2 leading-snug" style={{ fontFamily: t.fontHeading, fontWeight: t.headingWeight, fontSize: 15 * scale * t.headingScale, color: t.text }}>
            {t.headline}
          </p>
          <span className="inline-block px-3 py-1 font-bold" style={{ ...btn, borderRadius: Math.min(t.buttonRadius, 40), fontSize: 10 * scale }}>
            عرض المنتجات
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 px-3 pb-3">
          {[0, 1].map((i) => (
            <div key={i} className="overflow-hidden" style={{ background: t.card, color: t.cardText, border: `1px solid ${t.border}`, borderRadius: t.cardRadius }}>
              <div className="aspect-[4/3]" style={{ background: t.muted }} />
              <div className="space-y-1 p-1.5">
                <div className="h-1.5 w-3/4 rounded-full" style={{ background: t.cardText, opacity: 0.55 }} />
                <div className="flex items-center justify-between">
                  <span className="font-black" style={{ color: t.primary, fontSize: 10 * scale }}>
                    350 ج
                  </span>
                  <span className="rounded-full px-1.5" style={{ background: t.accent, color: t.accentText, fontSize: 8 * scale }}>
                    جديد
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </figure>
  );
}
