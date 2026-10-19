"use client";

// ProductImporter — أداة إضافة المنتجات: صور مجمّعة (الأسرع: كل صورة تُقرأ منتجاً)، أو كتابة حرة، أو ملف، وصور المحادثة
// إن وُجدت. تُستعمل في خطوة «المنتجات» بالإعداد وفي «استيراد منتجات» باللوحة. الطرق كلها تنتهي بشبكة مراجعة بحقول تتبع
// نشاط المتجر، والسعر وحده إلزامي. المراجعة تُحفظ تلقائياً على الجهاز فلا يضيع شيء عند إغلاق الصفحة، ولا يُحفظ في المتجر
// شيء قبل «اعتماد المنتجات».
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { CheckCircle2, FileSpreadsheet, ImagePlus, MessageSquareText, PenLine, Sparkles, UploadCloud } from "lucide-react";
import { importAnalyzeImagesAction, importAnalyzeTextAction, importCommitAction } from "@/server/actions/setup-import";
import { saveNicheAction } from "@/server/actions/setup";
import { rehostProductImagesAction } from "@/server/actions/product-import";
import { chunk, IMPORT_MAX_CANDIDATES, IMPORT_TEXT_CHUNK, mergeCandidates, missingPrice, newId, splitProductText, summarize, unifyCategories, type Candidate } from "@/lib/import-candidates";
import { isNiche, NICHE_LABEL, NICHES, type Niche } from "@/lib/niche-attributes";
import { BulkPhotos } from "./BulkPhotos";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AddBlankButton, ReviewGrid } from "./ReviewGrid";
import { btnGhost, btnPrimary, Notice, Spinner } from "./ui";

type Tab = "text" | "images" | "file" | "dm";
type Progress = { label: string; done: number; total: number } | null;

const TABS: { id: Tab; title: string; sub: string; icon: typeof PenLine }[] = [
  { id: "images", title: "صور المنتجات", sub: "كل الصور مرة واحدة، والسعر منكم", icon: ImagePlus },
  { id: "text", title: "اكتبوا منتجاتكم", sub: "منتج في كل سطر أو فقرة", icon: PenLine },
  { id: "file", title: "ارفعوا ملفاً", sub: "Excel أو PDF أو Word أو نص", icon: FileSpreadsheet },
];

const blank = (): Candidate => ({ id: newId(), name: "", price: null, compareAt: null, description: "", category: "", sizes: [], colors: [], images: [], stock: null, source: "manual", attributes: [] });

type Draft = { v: 1; niche: Niche; items: Candidate[] };
function readDraft(key: string | undefined): Draft | null {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    if (d?.v !== 1 || !Array.isArray(d.items)) return null;
    // الصور المحلية (معاينات لم تُرفع) لا تُستعاد: الروابط المرفوعة فقط.
    const items = d.items
      .filter((c) => c && typeof c.id === "string")
      .map((c) => ({ ...blank(), ...c, images: (c.images ?? []).filter((u) => /^https:\/\//.test(u)), attributes: Array.isArray(c.attributes) ? c.attributes : [] }));
    return items.length ? { v: 1, niche: isNiche(d.niche) ? d.niche : "other", items } : null;
  } catch {
    return null;
  }
}

export type CommitStats = { active: number; drafts: number; newCategories: number; variantCount: number };

export function ProductImporter({
  existingCategories,
  dmImages = [],
  onCommitted,
  commitLabel = "اعتماد المنتجات",
  niche: initialNiche = "other",
  draftKey,
}: {
  existingCategories: string[];
  dmImages?: string[];
  onCommitted: (s: CommitStats) => void;
  commitLabel?: string;
  /** نشاط المتجر (يحدد حقول المنتج). */
  niche?: Niche;
  /** مفتاح حفظ المراجعة على هذا الجهاز (يشمل معرّف المتجر). */
  draftKey?: string;
}) {
  const [tab, setTab] = useState<Tab>("images");
  const [niche, setNiche] = useState<Niche>(initialNiche);
  const [showErrors, setShowErrors] = useState(false);
  const [restored, setRestored] = useState(false);
  const [photosBusy, setPhotosBusy] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [text, setText] = useState("");
  const [cleanup, setCleanup] = useState(true);
  const [items, setItems] = useState<Candidate[]>([]);
  const [progress, setProgress] = useState<Progress>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const reviewRef = useRef<HTMLDivElement>(null);
  const tabsId = useId();
  const busy = progress !== null || saving || photosBusy;

  // استعادة المراجعة المحفوظة على الجهاز (بعد التحميل لا أثناء العرض الأول، فلا اختلاف بين الخادم والمتصفح).
  useEffect(() => {
    const d = readDraft(draftKey);
    if (d) {
      setItems(d.items);
      setRestored(true);
    }
    setDraftReady(true);
  }, [draftKey]);

  // الحفظ التلقائي للمراجعة (بعد توقف قصير عن الكتابة).
  useEffect(() => {
    if (!draftKey || !draftReady) return;
    const t = setTimeout(() => {
      try {
        if (items.length) localStorage.setItem(draftKey, JSON.stringify({ v: 1, niche, items } satisfies Draft));
        else localStorage.removeItem(draftKey);
      } catch {
        /* التخزين غير متاح (تصفح خاص): المراجعة تعمل بلا حفظ محلي */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [items, niche, draftKey, draftReady]);

  function changeNiche(n: Niche) {
    setNiche(n);
    void saveNicheAction({ niche: n });
  }

  const tabs = useMemo(() => (dmImages.length ? [...TABS, { id: "dm" as const, title: "صور المحادثة", sub: `${fmtNum(dmImages.length)} صورة أرسلتموها`, icon: MessageSquareText }] : TABS), [dmImages.length]);

  const addCandidates = useCallback((incoming: Candidate[]) => {
    setItems((cur) => unifyCategories(mergeCandidates(cur, incoming)));
    setTimeout(() => reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }, []);

  const runImages = useCallback(
    async (urls: string[]) => {
      const batches = chunk(urls, 4);
      let done = 0;
      for (const b of batches) {
        setProgress({ label: "نفرز الصور إلى منتجات", done, total: urls.length });
        // صور المحادثة وصفحات الملفات: قد تكون عدة صور للمنتج نفسه، فتُجمع المتشابهة.
        const r = await importAnalyzeImagesAction({ urls: b, mode: "grouped" });
        if (!r.ok) {
          setError(r.error);
          break;
        }
        if (r.notice) setNotice(r.notice);
        addCandidates(r.candidates);
        done += b.length;
      }
    },
    [addCandidates]
  );

  const runEntries = useCallback(
    async (entries: string[]) => {
      const batches = chunk(entries.slice(0, IMPORT_MAX_CANDIDATES * 2), IMPORT_TEXT_CHUNK);
      let done = 0;
      for (const b of batches) {
        setProgress({ label: "نفرز المنتجات", done, total: entries.length });
        const r = await importAnalyzeTextAction({ entries: b });
        if (!r.ok) {
          setError(r.error);
          break;
        }
        if (r.notice) setNotice(r.notice);
        addCandidates(r.candidates);
        done += b.length;
      }
    },
    [addCandidates]
  );

  async function onText() {
    setError(null);
    setNotice(null);
    const entries = splitProductText(text);
    if (!entries.length) return setError("اكتبوا منتجاً واحداً على الأقل، مثل: تيشيرت قطن أسود، مقاسات M L XL، 350 جنيه");
    try {
      await runEntries(entries);
    } finally {
      setProgress(null);
    }
    setText("");
  }

  async function onFile(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setNotice(null);
    try {
      setProgress({ label: "نقرأ الملف", done: 0, total: 1 });
      const fd = new FormData();
      [...files].slice(0, 12).forEach((f) => fd.append("file", f, f.name));
      const res = await fetch("/api/setup/import", { method: "POST", body: fd, credentials: "same-origin" });
      const j = (await res.json().catch(() => null)) as
        | { ok: true; kind: "candidates"; candidates: Candidate[]; notice?: string }
        | { ok: true; kind: "entries"; entries: string[] }
        | { ok: true; kind: "images"; urls: string[] }
        | { ok: false; error: string }
        | null;
      if (!j || !j.ok) return setError(j && !j.ok ? j.error : "تعذرت قراءة الملف. حاولوا مرة أخرى.");
      if (j.kind === "candidates") {
        if (j.notice) setNotice(j.notice);
        addCandidates(j.candidates.map((c) => ({ ...c, id: newId() })));
      } else if (j.kind === "entries") await runEntries(j.entries);
      else await runImages(j.urls);
    } catch {
      setError("تعذر الاتصال. تأكدوا من الإنترنت وحاولوا مرة أخرى.");
    } finally {
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onDm() {
    if (!picked.length) return;
    setError(null);
    setNotice(null);
    try {
      await runImages(picked);
      setPicked([]);
    } finally {
      setProgress(null);
    }
  }

  async function commit() {
    setError(null);
    const missing = missingPrice(items);
    if (missing.length) {
      setShowErrors(true);
      setError(missing.length === 1 ? "أضيفوا سعر المنتج المتبقي ثم اعتمدوا." : `أضيفوا أسعار ${fmtNum(missing.length)} منتجات ثم اعتمدوا. السعر هو الحقل الإلزامي الوحيد.`);
      const el = document.getElementById(`cand-${missing[0]!.id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => el?.querySelector<HTMLInputElement>("input[inputmode=decimal]")?.focus({ preventScroll: true }), 350);
      return;
    }
    setSaving(true);
    const r = await importCommitAction({ candidates: items, niche });
    if (!r.ok) {
      setSaving(false);
      return setError(r.error);
    }
    // صور بروابط خارجية (من ملف مثلاً): تُنقل إلى مساحة المتجر ليعرضها المتجر.
    for (const p of r.rehost) await rehostProductImagesAction({ id: p.id }).catch(() => null);
    setSaving(false);
    setItems([]);
    setShowErrors(false);
    setRestored(false);
    try {
      if (draftKey) localStorage.removeItem(draftKey);
    } catch {
      /* لا شيء */
    }
    onCommitted({ active: r.active, drafts: r.drafts, newCategories: r.newCategories, variantCount: r.variantCount });
  }

  const sum = summarize(items);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-edge/10 bg-edge/[0.03] p-3">
        <label htmlFor={`${tabsId}-niche`} className="text-[13px] font-black text-ink">
          نشاط المتجر
        </label>
        <select id={`${tabsId}-niche`} value={niche} onChange={(e) => changeNiche(e.target.value as Niche)} className="min-h-11 rounded-xl border border-edge/15 bg-space-2 px-3 text-[15px] font-bold text-ink outline-none focus:border-nova/60 focus:ring-2 focus:ring-nova/20">
          {NICHES.map((n) => (
            <option key={n} value={n}>
              {NICHE_LABEL[n]}
            </option>
          ))}
        </select>
        <span className="text-[12px] leading-5 text-ink-3">تظهر حقول المنتج المناسبة لنشاطكم فقط (مثل المقاسات للملابس، والسعة للإلكترونيات).</span>
      </div>

      {restored && items.length ? (
        <Notice tone="info">
          <p>استعدنا {fmtNum(items.length)} منتجاً لم تُعتمد بعد من زيارتكم السابقة.</p>
          <button
            type="button"
            className="mt-1 min-h-10 font-bold underline underline-offset-4"
            onClick={() => {
              setItems([]);
              setRestored(false);
            }}
          >
            البدء من جديد
          </button>
        </Notice>
      ) : null}

      <div role="tablist" aria-label="طرق إضافة المنتجات" className={cn("grid gap-2", tabs.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
        {tabs.map((t) => {
          const Icon = t.icon;
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              id={`${tabsId}-${t.id}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={`${tabsId}-panel`}
              onClick={() => setTab(t.id)}
              className={cn("flex items-center gap-3 rounded-2xl border p-3 text-start transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50", on ? "border-nova bg-nova/[0.07] ring-1 ring-nova/30" : "border-edge/12 hover:border-edge/30")}
            >
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", on ? "bg-nova text-white dark:text-space" : "bg-edge/[0.06] text-ink-2")}>
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-black text-ink">{t.title}</span>
                <span className="block text-[11.5px] text-ink-3">{t.sub}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${tab}`} className="dash-card p-4 sm:p-5">
        {tab === "text" ? (
          <div className="space-y-3">
            <label htmlFor={`${tabsId}-text`} className="text-[13px] font-black text-ink">
              اكتبوا منتجاتكم كما تقولونها لزبائنكم
            </label>
            <textarea
              id={`${tabsId}-text`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              disabled={busy}
              placeholder={"تيشيرت قطن أسود، مقاسات S M L XL، 350 جنيه\nحذاء رياضي أبيض، مقاسات 40 41 42 43، 890 جنيه\nشنطة جلد بني، 520 جنيه"}
              className="w-full resize-y rounded-xl border border-edge/10 bg-edge/[0.03] p-3.5 text-[13.5px] leading-7 text-ink outline-none transition-colors placeholder:text-ink-3/70 focus:border-nova/60 focus:ring-2 focus:ring-nova/20"
            />
            <p className="text-[12px] leading-5 text-ink-3">منتج في كل سطر أو فقرة. اذكروا السعر والمقاسات والألوان إن وُجدت، وما لا تذكرونه نتركه لكم في المراجعة.</p>
            <button type="button" onClick={() => void onText()} disabled={busy || !text.trim()} className={btnPrimary}>
              {progress ? <Spinner /> : <Sparkles className="size-4" aria-hidden="true" />}
              فرز المنتجات
            </button>
          </div>
        ) : null}

        {tab === "images" ? (
          <div className="space-y-4">
            <BulkPhotos
              niche={niche}
              categories={[...new Set([...existingCategories, ...items.map((i) => i.category).filter(Boolean)])]}
              cleanup={cleanup}
              onBusy={setPhotosBusy}
              onNotice={setNotice}
              onCandidate={(c) => setItems((cur) => [...cur, c].slice(0, IMPORT_MAX_CANDIDATES))}
              onAttach={(id, url) => setItems((cur) => cur.map((c) => (c.id === id ? { ...c, images: [...new Set([...c.images, url])].slice(0, 10) } : c)))}
            />
            <label className="flex min-h-11 cursor-pointer items-start gap-2.5 text-[13px] text-ink-2">
              <input type="checkbox" checked={cleanup} onChange={(e) => setCleanup(e.target.checked)} className="mt-1 size-5 accent-[var(--dash-nova)]" />
              <span>
                <span className="font-bold text-ink">تحسين الصور تلقائياً</span>
                <span className="block text-[12px] text-ink-3">تصحيح الاتجاه وقص الهوامش الفارغة وتوسيط المنتج (للصور التي لم تُزل خلفيتها).</span>
              </span>
            </label>
          </div>
        ) : null}

        {tab === "file" ? (
          <div className="space-y-3">
            <DropZone
              inputRef={fileRef}
              accept=".xlsx,.csv,.tsv,.pdf,.docx,.txt,image/*"
              disabled={busy}
              title="اسحبوا ملف المنتجات هنا أو اضغطوا للاختيار"
              hint="Excel (xlsx) أو CSV أو PDF أو Word (docx) أو نص أو صور، حتى 12 ميجابايت"
              onFiles={(f) => void onFile(f)}
            />
            <p className="text-[12px] leading-5 text-ink-3">في ملفات Excel وCSV نقرأ العناوين العربية والإنجليزية مثل: اسم المنتج، السعر، القسم، المقاسات، الألوان. وما عدا ذلك نقرأ محتواه كما هو.</p>
          </div>
        ) : null}

        {tab === "dm" ? (
          <div className="space-y-3">
            <p className="text-[13px] font-black text-ink">الصور التي أرسلتموها في المحادثة</p>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6" aria-label="صور المحادثة">
              {dmImages.map((u) => {
                const on = picked.includes(u);
                return (
                  <li key={u}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => setPicked(on ? picked.filter((x) => x !== u) : [...picked, u])}
                      className={cn("relative block aspect-square w-full overflow-hidden rounded-xl border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50", on ? "border-nova" : "border-transparent")}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt="" className="size-full object-cover" loading="lazy" />
                      {on ? <CheckCircle2 className="absolute end-1.5 top-1.5 size-5 rounded-full bg-nova text-white" aria-hidden="true" /> : null}
                      <span className="sr-only">{on ? "محددة" : "غير محددة"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnGhost} onClick={() => setPicked(picked.length === dmImages.length ? [] : [...dmImages])}>
                {picked.length === dmImages.length ? "إلغاء التحديد" : "تحديد الكل"}
              </button>
              <button type="button" className={btnPrimary} disabled={busy || !picked.length} onClick={() => void onDm()}>
                {progress ? <Spinner /> : null}
                تحويل المحدد ({fmtNum(picked.length)}) إلى منتجات
              </button>
            </div>
          </div>
        ) : null}

        {progress ? (
          <div className="mt-4" role="status" aria-live="polite">
            <div className="mb-1.5 flex items-center justify-between text-[12px] font-bold text-ink-2">
              <span className="inline-flex items-center gap-2">
                <Spinner className="size-3.5" />
                {progress.label}
              </span>
              <span className="tabular-nums">
                {fmtNum(Math.min(progress.done, progress.total))} / {fmtNum(progress.total)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-edge/10">
              <div className="h-full rounded-full bg-nova transition-[width] duration-500" style={{ width: `${Math.max(6, Math.round((progress.done / Math.max(1, progress.total)) * 100))}%` }} />
            </div>
          </div>
        ) : null}
      </div>

      {error ? <Notice tone="bad">{error}</Notice> : null}
      {notice ? <Notice tone="warn">{notice}</Notice> : null}

      <div ref={reviewRef} className="scroll-mt-24 space-y-3">
        {items.length ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-[16px] font-black text-ink">راجعوا منتجاتكم</h2>
                <p className="text-[12.5px] text-ink-3">
                  {fmtNum(sum.total)} منتج{sum.categories.length ? ` في ${fmtNum(sum.categories.length)} ${sum.categories.length === 1 ? "قسم" : "أقسام"}` : ""}. عدّلوا أي شيء قبل الاعتماد.
                </p>
              </div>
              <AddBlankButton disabled={items.length >= IMPORT_MAX_CANDIDATES || saving} onAdd={() => setItems((c) => [blank(), ...c])} />
            </div>
            <ReviewGrid items={items} onChange={setItems} existingCategories={existingCategories} niche={niche} showErrors={showErrors} />
            <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-edge/15 bg-space-2/95 p-3 shadow-lg backdrop-blur">
              <p className="text-[13px] text-ink-2" aria-live="polite">
                {sum.drafts ? (
                  <>
                    <b className="text-ink">{fmtNum(sum.ready)}</b> جاهز، و<b className="text-bad">{fmtNum(sum.drafts)}</b> ينقصه السعر
                  </>
                ) : (
                  <>
                    <b className="text-ink">{fmtNum(sum.total)}</b> منتج جاهز للظهور في المتجر
                  </>
                )}
                {draftKey ? <span className="block text-[11.5px] text-ink-3">تُحفظ المراجعة تلقائياً على هذا الجهاز.</span> : null}
              </p>
              <button type="button" className={cn(btnPrimary, "min-h-12 text-[15px]")} disabled={busy || !items.length} onClick={() => void commit()}>
                {saving ? <Spinner /> : <CheckCircle2 className="size-4" aria-hidden="true" />}
                {commitLabel}
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12.5px] text-ink-3">تظهر المنتجات هنا لمراجعتها وكتابة أسعارها قبل الاعتماد.</p>
            <AddBlankButton onAdd={() => setItems([blank()])} />
          </div>
        )}
      </div>
    </div>
  );
}

function DropZone({
  inputRef,
  accept,
  multiple,
  disabled,
  title,
  hint,
  onFiles,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  title: string;
  hint: string;
  onFiles: (f: FileList) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled && e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
      }}
      className={cn("rounded-2xl border-2 border-dashed p-6 text-center transition", over ? "border-nova bg-nova/[0.06]" : "border-edge/20")}
    >
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} disabled={disabled} className="sr-only" tabIndex={-1} onChange={(e) => e.target.files && onFiles(e.target.files)} />
      <UploadCloud className="mx-auto size-8 text-ink-3" aria-hidden="true" />
      <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()} className="mt-2 text-[14px] font-black text-ink underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50 disabled:opacity-60">
        {title}
      </button>
      <p className="mt-1 text-[12px] text-ink-3">{hint}</p>
    </div>
  );
}
