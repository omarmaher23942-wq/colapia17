"use client";

// BulkPhotos — الرفع المجمّع لصور المنتجات: يختار التاجر كل الصور مرة واحدة، ويحدد ما يريد إزالة خلفيته (لكل صورة أو
// للكل)، ويجمع صور المنتج الواحد معاً (بالسحب أو التحديد)، ثم يبدأ: ثلاث صور معاً، ولكل صورة تقدمها (إزالة الخلفية ←
// الرفع ← القراءة). كل منتج يُقرأ ما إن تُرفع صورته ويظهر للمراجعة فوراً، والسعر يكتبه التاجر بنفسه.
// إزالة الخلفية في المتصفح نفسه؛ إن تعذرت لصورة تُستخدم الأصلية ونقول ذلك بوضوح.
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Camera, CheckCircle2, Eraser, ImagePlus, Layers, RotateCcw, UploadCloud, X } from "lucide-react";
import { readProductPhotoAction } from "@/server/actions/setup-import";
import { newId, type Candidate } from "@/lib/import-candidates";
import { attributesFor, setAttr, usesSizeColor, type Niche } from "@/lib/niche-attributes";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BG_UNSUPPORTED_NOTE, bgRemovalReady, bgRemovalSupported, onBgProgress, removeBackground, type BgMode } from "./bg-removal";
import { btnGhost, btnPrimary, Notice, Spinner } from "./ui";
import { uploadOneImage } from "./upload";

type Status = "staged" | "queued" | "bg" | "uploading" | "reading" | "done" | "error";
type Entry = { id: string; file: File; preview: string; removeBg: boolean; group: string; status: Status; note?: string; error?: string };

const STATUS_TEXT: Record<Status, string> = {
  staged: "جاهزة",
  queued: "في الانتظار",
  bg: "إزالة الخلفية…",
  uploading: "جارٍ الرفع…",
  reading: "جارٍ القراءة…",
  done: "تمت",
  error: "تعذرت",
};

const MAX_FILES = 60;
const PARALLEL = 3;

export function BulkPhotos({
  niche,
  categories,
  cleanup,
  onCandidate,
  onAttach,
  onNotice,
  onBusy,
  onRunDone,
}: {
  niche: Niche;
  categories: string[];
  /** تصحيح الاتجاه وقص الهوامش للصور التي لم تُزل خلفيتها. */
  cleanup: boolean;
  onCandidate: (c: Candidate) => void;
  /** صورة إضافية لمنتج ظهر بالفعل (صور المنتج نفسه). */
  onAttach: (candidateId: string, url: string) => void;
  onNotice: (n: string) => void;
  onBusy: (busy: boolean) => void;
  /** تنتهي دفعة الرفع: معرّفات المنتجات التي ظهرت فيها (للتصنيف المجمّع الواحد). */
  onRunDone?: (ids: string[]) => void;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [bgMode, setBgMode] = useState<BgMode>("white");
  const [running, setRunning] = useState(false);
  const [tool, setTool] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [over, setOver] = useState<string | null>(null);
  const [dropOver, setDropOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const seen = useRef(new Set<string>()); // بصمات ملفات أُضيفت في هذه الجلسة: الصورة نفسها لا تُضاف مرتين
  const runIds = useRef<string[]>([]);
  const entriesRef = useRef<Entry[]>([]);
  const groupDone = useRef(new Map<string, string>()); // المجموعة ← معرّف المنتج الذي ظهر
  const groupBuffer = useRef(new Map<string, string[]>()); // صور وصلت قبل ظهور منتجها
  const bgFailed = useRef(0);
  const uid = useId();
  entriesRef.current = entries;

  useEffect(() => () => entriesRef.current.forEach((e) => URL.revokeObjectURL(e.preview)), []);
  useEffect(() => onBusy(running), [running, onBusy]);

  useEffect(
    () =>
      onBgProgress((p) => {
        if (p.phase === "loading") {
          const pct = p.total > 0 ? Math.min(99, Math.round((p.loaded / p.total) * 100)) : null;
          setTool(`جارٍ تجهيز أداة إزالة الخلفية لأول مرة${pct !== null ? ` (${fmtNum(pct)}%)` : ""}… تبقى جاهزة على هذا الجهاز بعدها.`);
        } else setTool(null);
      }),
    []
  );

  const update = (id: string, p: Partial<Entry>) => setEntries((cur) => cur.map((e) => (e.id === id ? { ...e, ...p } : e)));

  function addFiles(list: FileList | File[]) {
    const all = [...list];
    const files = all.filter((f) => /^image\/(jpeg|png|webp)$/i.test(f.type) || (!f.type && /\.(jpe?g|png|webp)$/i.test(f.name)));
    if (files.length < all.length) onNotice(`تجاهلنا ${fmtNum(all.length - files.length)} ملفاً بصيغة غير مدعومة. الصور المقبولة: JPG أو PNG أو WEBP (صور آيفون HEIC تُحفظ بصيغة JPG من إعدادات الكاميرا).`);
    // الصورة نفسها (اسم وحجم وتاريخ) لا تُضاف مرتين، سواء في القائمة أو بعد رفعها.
    const fresh0 = files.filter((f) => {
      const k = `${f.name}:${f.size}:${f.lastModified}`;
      if (seen.current.has(k)) return false;
      seen.current.add(k);
      return true;
    });
    if (fresh0.length < files.length) onNotice(`تجاهلنا ${fmtNum(files.length - fresh0.length)} صورة مكررة سبق اختيارها.`);
    files.splice(0, files.length, ...fresh0);
    const room = MAX_FILES - entriesRef.current.length;
    if (files.length > room) onNotice(`يمكن تجهيز ${fmtNum(MAX_FILES)} صورة في الدفعة الواحدة. أضفنا أول ${fmtNum(Math.max(0, room))}، وارفعوا الباقي بعد الانتهاء.`);
    const fresh = files.slice(0, Math.max(0, room)).map((file) => {
      const id = newId();
      return { id, file, preview: URL.createObjectURL(file), removeBg: false, group: id, status: "staged" as Status };
    });
    setEntries((cur) => [...cur, ...fresh]);
  }

  const staged = entries.filter((e) => e.status === "staged" || e.status === "error");
  const anyBg = staged.some((e) => e.removeBg);
  const allBg = staged.length > 0 && staged.every((e) => e.removeBg);
  const groupsCount = new Set(staged.map((e) => e.group)).size;

  function groupTogether(ids: string[]) {
    if (ids.length < 2) return;
    const target = entriesRef.current.find((e) => ids.includes(e.id))!.group;
    const old = new Set(entriesRef.current.filter((e) => ids.includes(e.id)).map((e) => e.group));
    setEntries((cur) => cur.map((e) => (old.has(e.group) ? { ...e, group: target } : e)));
    setPicked([]);
  }
  const ungroup = (id: string) => update(id, { group: id });

  /** صورة واحدة: إزالة الخلفية (إن طُلبت) ← رفع ← قراءة (لأول صورة في مجموعتها فقط). */
  const processOne = useCallback(
    async (e: Entry, leader: boolean) => {
      let file = e.file;
      let removed = false;
      if (e.removeBg) {
        update(e.id, { status: "bg" });
        try {
          file = await removeBackground(e.file, bgMode);
          removed = true;
        } catch {
          bgFailed.current += 1;
          update(e.id, { note: "تعذرت إزالة الخلفية، فاستخدمنا الصورة الأصلية" });
        }
      }
      update(e.id, { status: "uploading" });
      let url: string;
      try {
        url = await uploadOneImage(file, { cleanup: cleanup && !removed });
      } catch (err) {
        update(e.id, { status: "error", error: err instanceof Error ? err.message : "تعذر الرفع" });
        return;
      }
      if (!leader) {
        const cid = groupDone.current.get(e.group);
        if (cid) onAttach(cid, url);
        else groupBuffer.current.set(e.group, [...(groupBuffer.current.get(e.group) ?? []), url]);
        update(e.id, { status: "done" });
        return;
      }
      update(e.id, { status: "reading" });
      const r = await readProductPhotoAction({ url, niche, categories }).catch(() => null);
      const read = r && r.ok ? r.read : { name: "", color: "", category: "", description: "", attributes: [] };
      if (r && r.ok && r.notice) onNotice(r.notice);
      let attributes = read.attributes;
      const sizeColor = usesSizeColor(niche);
      if (!sizeColor && read.color && attributesFor(niche).some((a) => a.label === "اللون")) attributes = setAttr(attributes, "اللون", read.color);
      const id = e.group;
      const extra = groupBuffer.current.get(e.group) ?? [];
      groupBuffer.current.delete(e.group);
      groupDone.current.set(e.group, id);
      runIds.current.push(id);
      onCandidate({
        id,
        name: read.name,
        price: null,
        compareAt: null,
        description: read.description,
        category: read.category,
        sizes: [],
        colors: sizeColor && read.color ? [read.color] : [],
        images: [url, ...extra].slice(0, 10),
        stock: null,
        source: "image",
        attributes,
      });
      update(e.id, { status: "done" });
    },
    [bgMode, categories, cleanup, niche, onAttach, onCandidate, onNotice]
  );

  async function start() {
    const queue = entriesRef.current.filter((e) => e.status === "staged" || e.status === "error");
    if (!queue.length) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      onNotice("لا يوجد اتصال بالإنترنت الآن. صوركم محفوظة هنا، اضغطوا «رفع» مرة أخرى عند عودة الاتصال.");
      return;
    }
    bgFailed.current = 0;
    runIds.current = [];
    setRunning(true);
    if (queue.some((e) => e.removeBg) && !bgRemovalReady()) setTool("جارٍ تجهيز أداة إزالة الخلفية…");
    setEntries((cur) => cur.map((e) => (queue.some((q) => q.id === e.id) ? { ...e, status: "queued", error: undefined, note: undefined } : e)));
    // قائد كل مجموعة أولاً (يُقرأ ويظهر منتجه)، ثم بقية صورها (تُرفع وتُضم إليه).
    const leaders = new Set<string>();
    const ordered = [...queue].sort((a, b) => Number(a.group !== a.id) - Number(b.group !== b.id));
    const tasks = ordered.map((e) => {
      const leader = !leaders.has(e.group) && !groupDone.current.has(e.group);
      if (leader) leaders.add(e.group);
      return { e, leader };
    });
    let next = 0;
    const worker = async () => {
      while (next < tasks.length) {
        const t = tasks[next++]!;
        await processOne(t.e, t.leader);
      }
    };
    try {
      await Promise.all(Array.from({ length: Math.min(PARALLEL, tasks.length) }, worker));
    } finally {
      setRunning(false);
      setTool(null);
      if (runIds.current.length) onRunDone?.(runIds.current);
      if (bgFailed.current) onNotice(`تعذرت إزالة الخلفية في ${fmtNum(bgFailed.current)} صورة، فرفعنا الأصلية كما هي.`);
      // ما تم يخرج من القائمة (صار منتجاً في المراجعة)، وما فشل يبقى لإعادة المحاولة.
      setEntries((cur) => {
        cur.filter((e) => e.status === "done").forEach((e) => URL.revokeObjectURL(e.preview));
        return cur.filter((e) => e.status !== "done");
      });
    }
  }

  const doneCount = entries.filter((e) => e.status === "done").length;
  const total = entries.length;

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            setDropOver(true);
          }
        }}
        onDragLeave={() => setDropOver(false)}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return;
          e.preventDefault();
          setDropOver(false);
          if (!running) addFiles(e.dataTransfer.files);
        }}
        className={cn("rounded-2xl border-2 border-dashed p-6 text-center transition", dropOver ? "border-nova bg-nova/[0.06]" : "border-edge/20")}
      >
        <input
          ref={inputRef}
          id={`${uid}-files`}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={running}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {/* التصوير المباشر: كاميرا الهاتف الخلفية، لقطة بعد لقطة */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          disabled={running}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <UploadCloud className="mx-auto size-9 text-ink-3" aria-hidden="true" />
        <div className="mt-3 flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center">
          <button type="button" disabled={running} onClick={() => cameraRef.current?.click()} className={cn(btnPrimary, "min-h-14 text-[15px] sm:min-h-12")}>
            <Camera className="size-5" aria-hidden="true" />
            {entries.length ? "صوّروا منتجاً آخر" : "صوّروا المنتج"}
          </button>
          <button type="button" disabled={running} onClick={() => inputRef.current?.click()} className={cn(btnGhost, "min-h-14 text-[15px] sm:min-h-12")}>
            <ImagePlus className="size-5" aria-hidden="true" />
            اختيار من المعرض
          </button>
        </div>
        <p className="mt-2 text-[12.5px] leading-6 text-ink-3">صوّروا المنتج على خلفية نظيفة وإضاءة جيدة، أو اختاروا صوراً جاهزة (حتى {fmtNum(MAX_FILES)} صورة). كل صورة تصير منتجاً، والسعر تكتبونه أنتم.</p>
      </div>

      {entries.length ? (
        <section aria-labelledby={`${uid}-staged`} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id={`${uid}-staged`} className="text-[14px] font-black text-ink">
              {running ? `${fmtNum(total)} صورة قيد التجهيز` : `${fmtNum(staged.length)} صورة ← ${fmtNum(groupsCount)} منتج`}
            </h3>
            <div className="flex flex-wrap gap-2">
              {picked.length >= 2 ? (
                <button type="button" className={btnGhost} onClick={() => groupTogether(picked)}>
                  <Layers className="size-4" aria-hidden="true" />
                  صور لمنتج واحد ({fmtNum(picked.length)})
                </button>
              ) : null}
              {bgRemovalSupported() ? (
                <button type="button" className={btnGhost} aria-pressed={allBg} disabled={running} onClick={() => setEntries((cur) => cur.map((e) => (e.status === "staged" || e.status === "error" ? { ...e, removeBg: !allBg } : e)))}>
                  <Eraser className="size-4" aria-hidden="true" />
                  {allBg ? "إلغاء إزالة الخلفية للكل" : "إزالة الخلفية للكل"}
                </button>
              ) : null}
            </div>
          </div>

          {anyBg ? (
            <fieldset className="flex flex-wrap items-center gap-2 rounded-xl border border-edge/10 bg-edge/[0.03] p-3">
              <legend className="sr-only">الخلفية بعد الإزالة</legend>
              <span className="text-[13px] font-bold text-ink-2">الخلفية بعد الإزالة:</span>
              {(
                [
                  ["white", "بيضاء"],
                  ["transparent", "شفافة"],
                ] as const
              ).map(([v, t]) => (
                <label key={v} className={cn("inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-[13px] font-bold", bgMode === v ? "border-nova bg-nova/10 text-ink" : "border-edge/15 text-ink-2")}>
                  <input type="radio" name={`${uid}-bg`} checked={bgMode === v} onChange={() => setBgMode(v)} className="accent-[var(--dash-nova)]" />
                  {t}
                </label>
              ))}
              <span className="text-[12px] leading-5 text-ink-3">تعمل على جهازكم، وأول مرة تحتاج تنزيل الأداة (بين 100 و250 ميجابايت حسب الجهاز) ثم تبقى جاهزة.</span>
            </fieldset>
          ) : null}

          <p className="text-[12px] leading-5 text-ink-3">أكثر من صورة للمنتج نفسه؟ حدّدوها ثم «صور لمنتج واحد»، أو اسحبوا صورة فوق أخرى.</p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4" aria-label="الصور المختارة">
            {entries.map((e) => {
              const grouped = entries.filter((x) => x.group === e.group).length > 1;
              const lead = entries.find((x) => x.group === e.group)?.id === e.id;
              const on = picked.includes(e.id);
              const editable = !running && (e.status === "staged" || e.status === "error");
              return (
                <li
                  key={e.id}
                  draggable={editable}
                  onDragStart={(ev) => ev.dataTransfer.setData("application/x-clp-photo", e.id)}
                  onDragOver={(ev) => {
                    if (ev.dataTransfer.types.includes("application/x-clp-photo")) {
                      ev.preventDefault();
                      setOver(e.id);
                    }
                  }}
                  onDragLeave={() => setOver(null)}
                  onDrop={(ev) => {
                    const src = ev.dataTransfer.getData("application/x-clp-photo");
                    setOver(null);
                    if (src && src !== e.id) {
                      ev.preventDefault();
                      groupTogether([e.id, src]);
                    }
                  }}
                  className={cn("dash-card overflow-hidden p-2 transition", on && "ring-2 ring-nova", over === e.id && "ring-2 ring-nova bg-nova/[0.06]")}
                >
                  <div className="relative aspect-square overflow-hidden rounded-lg bg-edge/[0.05]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={e.preview} alt={`صورة ${e.file.name}`} className="size-full object-cover" decoding="async" />
                    {grouped ? <span className="absolute start-1.5 top-1.5 rounded-md bg-nova px-1.5 py-0.5 text-[11px] font-black text-white dark:text-space">{lead ? "الصورة الرئيسية" : "صورة إضافية"}</span> : null}
                    {e.status !== "staged" ? (
                      <span className={cn("absolute inset-x-1.5 bottom-1.5 flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-bold", e.status === "error" ? "bg-bad text-white" : e.status === "done" ? "bg-ok text-white" : "bg-black/70 text-white")} role="status">
                        {e.status === "done" ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : e.status === "error" ? null : <Spinner className="size-3.5" />}
                        {STATUS_TEXT[e.status]}
                      </span>
                    ) : null}
                    {editable ? (
                      <button type="button" aria-label="إزالة الصورة من القائمة" onClick={() => { URL.revokeObjectURL(e.preview); seen.current.delete(`${e.file.name}:${e.file.size}:${e.file.lastModified}`); setEntries((cur) => cur.filter((x) => x.id !== e.id)); }} className="absolute end-1.5 top-1.5 grid size-9 place-items-center rounded-full bg-black/60 text-white hover:bg-bad focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                  {e.error ? <p className="mt-1.5 text-[11.5px] font-bold leading-5 text-bad">{e.error}</p> : null}
                  {e.note ? <p className="mt-1.5 text-[11.5px] leading-5 text-warn">{e.note}</p> : null}
                  {editable ? (
                    <div className="mt-2 space-y-1">
                      <label className="flex min-h-10 cursor-pointer items-center gap-2 text-[12.5px] font-bold text-ink-2">
                        <input type="checkbox" checked={on} onChange={(ev) => setPicked((cur) => (ev.target.checked ? [...cur, e.id] : cur.filter((x) => x !== e.id)))} className="size-[18px] accent-[var(--dash-nova)]" />
                        تحديد
                      </label>
                      {bgRemovalSupported() ? (
                        <label className="flex min-h-10 cursor-pointer items-center gap-2 text-[12.5px] font-bold text-ink-2">
                          <input type="checkbox" checked={e.removeBg} onChange={(ev) => update(e.id, { removeBg: ev.target.checked })} className="size-[18px] accent-[var(--dash-nova)]" />
                          إزالة الخلفية
                        </label>
                      ) : null}
                      {grouped && !lead ? (
                        <button type="button" onClick={() => ungroup(e.id)} className="min-h-10 text-[12px] font-bold text-ink-3 underline-offset-4 hover:text-ink hover:underline">
                          منتج مستقل
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {tool ? <Notice tone="info">{tool}</Notice> : null}
          {!bgRemovalSupported() ? <p className="text-[12px] leading-5 text-ink-3">{BG_UNSUPPORTED_NOTE}</p> : null}

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={cn(btnPrimary, "min-h-12 text-[15px]")} disabled={running || !staged.length} onClick={() => void start()}>
              {running ? <Spinner /> : staged.some((e) => e.status === "error") ? <RotateCcw className="size-4" aria-hidden="true" /> : <UploadCloud className="size-4" aria-hidden="true" />}
              {running ? "جارٍ التجهيز…" : staged.some((e) => e.status === "error") ? "إعادة المحاولة" : `رفع الصور وتجهيز ${fmtNum(groupsCount)} منتج`}
            </button>
            {running ? (
              <p className="text-[12.5px] font-bold text-ink-2" role="status" aria-live="polite">
                {fmtNum(doneCount)} من {fmtNum(total)} صورة
              </p>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
