"use client";

// LookPanel — واجهة المتجر (فيديو/صورة/تلقائي) وحقل «اكتبوا ما تريدون تغييره». نفس اللوحة في خطوة «لمسات الشكل» بالإعداد
// وفي صفحة «شكل المتجر». كل تغيير يُحفظ فوراً ويُحدّث المعاينة، وتعديل الكلام يمكن التراجع عنه بضغطة.
import { useRef, useState } from "react";
import { ImagePlus, Undo2, Video, Wand2 } from "lucide-react";
import { saveHeroMediaAction, tweakDesignAction, undoDesignAction } from "@/server/actions/setup";
import type { HeroMediaChoice } from "@/lib/design-tweak";
import { cn } from "@/lib/utils";
import { btnGhost, btnPrimary, Notice, OptionCard, Spinner } from "./ui";
import { probeVideo, uploadImages, uploadVideo } from "./upload";

type HeroOpt = "auto" | "video_fashion" | "video_electronics" | "video_upload" | "side_image";
const OPTIONS: { id: HeroOpt; title: string; sub: string }[] = [
  { id: "auto", title: "تلقائي من منتجاتكم", sub: "نعرض صور منتجاتكم في الواجهة بأفضل تخطيط." },
  { id: "video_fashion", title: "فيديو احترافي جاهز للملابس", sub: "خلفية متحركة أنيقة تناسب الأزياء." },
  { id: "video_electronics", title: "فيديو احترافي جاهز للإلكترونيات", sub: "خلفية متحركة عصرية تناسب الأجهزة." },
  { id: "video_upload", title: "رفع فيديو خاص بكم", sub: "نلتقط له صورة غلاف تلقائياً تظهر فوراً قبل تحميل الفيديو." },
  { id: "side_image", title: "صورة جانبية", sub: "صورة واحدة بجانب العنوان، بتخطيط هادئ وسريع." },
];

const SUGGESTIONS = ["اجعلوا الأزرار خضراء", "كبّروا الخط", "اجعلوا الزوايا أكثر استدارة", "غيّروا خلفية الموقع إلى الأبيض"];

/** الاختيار الحالي من رابط الفيديو المحفوظ (الجاهزان معروفان بمساراتهما). */
function initialOpt(kind: "video" | "image" | "auto", videoUrl?: string | null): HeroOpt | null {
  if (kind === "auto") return "auto";
  if (kind === "image") return "side_image";
  if (!videoUrl) return null;
  if (videoUrl.includes("/demo/media/hero-fashion")) return "video_fashion";
  if (videoUrl.includes("/demo/media/hero-electronics")) return "video_electronics";
  return "video_upload";
}

export function LookPanel({ initialHero, heroVideoUrl, onChanged }: { initialHero: "video" | "image" | "auto"; heroVideoUrl?: string | null; onChanged: () => void }) {
  const [opt, setOpt] = useState<HeroOpt | null>(initialOpt(initialHero, heroVideoUrl));
  const [videoPct, setVideoPct] = useState<number | null>(null);
  const [videoStage, setVideoStage] = useState<string>("");
  const [busy, setBusy] = useState<HeroOpt | null>(null);
  const [heroMsg, setHeroMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState("");
  const [tweakBusy, setTweakBusy] = useState(false);
  const [tweak, setTweak] = useState<{ ok: boolean; applied: boolean; summary: string; undoVersion: number | null } | null>(null);
  const [undoing, setUndoing] = useState(false);

  async function apply(choice: HeroMediaChoice, key: HeroOpt) {
    setBusy(key);
    setHeroMsg(null);
    const r = await saveHeroMediaAction(choice);
    setBusy(null);
    if (!r.ok) return setHeroMsg({ tone: "bad", text: r.error });
    setOpt(key);
    setHeroMsg({ tone: "ok", text: `${r.summary}. تحققوا من المعاينة.` });
    onChanged();
  }

  async function onVideo(f: File | undefined) {
    if (!f) return;
    setBusy("video_upload");
    setHeroMsg(null);
    try {
      if (f.size > 40 << 20) return setHeroMsg({ tone: "bad", text: "الفيديو أكبر من 40 ميجابايت. اختصروه أو اضغطوه ثم ارفعوه." });
      // 1) نتأكد أن المتصفح يشغّله، ونلتقط صورة الغلاف من لقطة مبكرة.
      setVideoStage("نتحقق من الفيديو ونلتقط صورة الغلاف…");
      const probe = await probeVideo(f);
      if (!probe.ok) return setHeroMsg({ tone: "bad", text: probe.error });
      // 2) الغلاف أولاً (صغير): بدونه لا تظهر الواجهة فوراً.
      let posterUrl: string | undefined;
      if (probe.poster) {
        setVideoStage("نرفع صورة الغلاف…");
        const up = await uploadImages([probe.poster], { route: "brandAsset", keepAlpha: false });
        posterUrl = up.urls[0];
        if (!posterUrl) return setHeroMsg({ tone: "bad", text: up.error ?? "تعذر رفع صورة الغلاف. حاولوا مرة أخرى." });
      }
      // 3) الفيديو بتقدم حقيقي.
      setVideoStage("نرفع الفيديو…");
      setVideoPct(0);
      const v = await uploadVideo(f, setVideoPct);
      if (!v.ok) return setHeroMsg({ tone: "bad", text: v.error });
      setVideoStage("نطبّق الفيديو على الواجهة…");
      await apply({ kind: "video_upload", url: v.url, poster: posterUrl }, "video_upload");
    } catch {
      setHeroMsg({ tone: "bad", text: "تعذر الاتصال. تأكدوا من الإنترنت وحاولوا مرة أخرى." });
    } finally {
      setVideoPct(null);
      setVideoStage("");
      setBusy((b) => (b === "video_upload" ? null : b));
      if (videoRef.current) videoRef.current.value = "";
    }
  }

  async function onImage(f: File | undefined) {
    if (!f) return;
    setBusy("side_image");
    setHeroMsg(null);
    const up = await uploadImages([f], { route: "brandAsset", keepAlpha: false });
    if (!up.urls[0]) {
      setBusy(null);
      return setHeroMsg({ tone: "bad", text: up.error ?? "تعذر رفع الصورة" });
    }
    await apply({ kind: "side_image", url: up.urls[0] }, "side_image");
    if (imageRef.current) imageRef.current.value = "";
  }

  async function runTweak(t = text) {
    if (!t.trim()) return;
    setTweakBusy(true);
    setTweak(null);
    const r = await tweakDesignAction({ text: t });
    setTweakBusy(false);
    if (!r.ok) return setTweak({ ok: false, applied: false, summary: r.error, undoVersion: null });
    setTweak({ ok: true, applied: r.applied, summary: r.summary, undoVersion: r.undoVersion });
    if (r.applied) {
      setText("");
      onChanged();
    }
  }

  async function undo() {
    if (!tweak?.undoVersion) return;
    setUndoing(true);
    const r = await undoDesignAction({ version: tweak.undoVersion });
    setUndoing(false);
    if (!r.ok) return setTweak({ ok: false, applied: false, summary: r.error, undoVersion: null });
    setTweak({ ok: true, applied: false, summary: "تراجعنا عن التعديل وعاد المتجر كما كان.", undoVersion: null });
    onChanged();
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="hero-media" className="space-y-3">
        <h2 id="hero-media" className="text-[15px] font-black text-ink">
          واجهة المتجر
        </h2>
        <div className="space-y-2.5" role="radiogroup" aria-label="وسائط واجهة المتجر">
          {OPTIONS.map((o) => (
            <OptionCard
              key={o.id}
              name="hero"
              selected={opt === o.id}
              onSelect={() => {
                if (o.id === "auto" || o.id === "video_fashion" || o.id === "video_electronics") void apply({ kind: o.id }, o.id);
                else setOpt(o.id);
              }}
              title={o.title}
              description={o.sub}
              icon={busy === o.id ? <Spinner className="size-3.5" /> : o.id.startsWith("video") ? <Video className="size-4 text-ink-3" aria-hidden="true" /> : o.id === "side_image" ? <ImagePlus className="size-4 text-ink-3" aria-hidden="true" /> : undefined}
            >
              {o.id === "video_upload" ? (
                <>
                  <input ref={videoRef} type="file" accept="video/mp4,video/webm" className="sr-only" tabIndex={-1} onChange={(e) => void onVideo(e.target.files?.[0])} />
                  <button type="button" className={btnGhost} disabled={busy !== null} onClick={() => videoRef.current?.click()}>
                    {busy === "video_upload" ? <Spinner /> : <Video className="size-4" aria-hidden="true" />}
                    {busy === "video_upload" ? "جارٍ الرفع…" : "اختيار الفيديو"}
                  </button>
                  {busy === "video_upload" && videoStage ? (
                    <div className="mt-3" role="status" aria-live="polite">
                      <p className="text-[12px] font-bold text-ink-2">{videoStage}</p>
                      {videoPct !== null ? (
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-edge/10" role="progressbar" aria-label="تقدم رفع الفيديو" aria-valuemin={0} aria-valuemax={100} aria-valuenow={videoPct}>
                            <div className="h-full rounded-full bg-nova transition-[width] duration-300" style={{ width: `${Math.max(4, videoPct)}%` }} />
                          </div>
                          <span className="w-10 text-end text-[11.5px] font-black tabular-nums text-ink-2">{videoPct}%</span>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <p className="mt-2 text-[11.5px] leading-5 text-ink-3">MP4 أو WEBM حتى 40 ميجابايت. لا يعمل الفيديو مع توفير البيانات، فيظهر الغلاف بدلاً منه. الأفضل فيديو قصير بلا صوت من 10 إلى 20 ثانية.</p>
                </>
              ) : null}
              {o.id === "side_image" ? (
                <>
                  <input ref={imageRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => void onImage(e.target.files?.[0])} />
                  <button type="button" className={btnGhost} disabled={busy !== null} onClick={() => imageRef.current?.click()}>
                    {busy === "side_image" ? <Spinner /> : <ImagePlus className="size-4" aria-hidden="true" />}
                    {busy === "side_image" ? "جارٍ الرفع…" : "اختيار الصورة"}
                  </button>
                </>
              ) : null}
            </OptionCard>
          ))}
        </div>
        {heroMsg ? <Notice tone={heroMsg.tone}>{heroMsg.text}</Notice> : null}
      </section>

      <section aria-labelledby="tweak" className="space-y-3">
        <div>
          <h2 id="tweak" className="text-[15px] font-black text-ink">
            اكتبوا ما تريدون تغييره
          </h2>
          <p className="text-[12.5px] leading-6 text-ink-3">صفوا التعديل بجملتكم: الألوان، حجم الخط، الزوايا، ترتيب الأقسام، نص الإعلان. نطبّقه فوراً ويمكنكم التراجع بضغطة.</p>
        </div>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void runTweak();
          }}
        >
          <label htmlFor="tweak-text" className="sr-only">
            التعديل المطلوب
          </label>
          <textarea
            id="tweak-text"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 400))}
            rows={3}
            disabled={tweakBusy}
            placeholder="مثال: غيّروا اللون الأسود إلى الأبيض وكبّروا الخط"
            className="w-full resize-y rounded-xl border border-edge/10 bg-edge/[0.03] p-3.5 text-[13.5px] leading-7 text-ink outline-none transition-colors placeholder:text-ink-3/70 focus:border-nova/60 focus:ring-2 focus:ring-nova/20"
          />
          <div className="flex flex-wrap gap-1.5" aria-label="أمثلة سريعة">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" disabled={tweakBusy} onClick={() => void runTweak(s)} className="min-h-9 rounded-full border border-edge/15 px-3 text-[12px] font-bold text-ink-2 transition hover:border-nova/50 hover:text-ink disabled:opacity-50">
                {s}
              </button>
            ))}
          </div>
          <button type="submit" disabled={tweakBusy || !text.trim()} className={btnPrimary}>
            {tweakBusy ? <Spinner /> : <Wand2 className="size-4" aria-hidden="true" />}
            تطبيق التعديل
          </button>
        </form>
        {tweak ? (
          <Notice tone={!tweak.ok ? "bad" : tweak.applied ? "ok" : "warn"}>
            <p>{tweak.summary}</p>
            {tweak.applied && tweak.undoVersion ? (
              <button type="button" onClick={() => void undo()} disabled={undoing} className={cn(btnGhost, "mt-2 min-h-10 border-current/30 text-current")}>
                {undoing ? <Spinner /> : <Undo2 className="size-4" aria-hidden="true" />}
                تراجع
              </button>
            ) : null}
          </Notice>
        ) : null}
      </section>
    </div>
  );
}
