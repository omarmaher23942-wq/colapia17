"use client";

// "امتلك متجرك": أربع محطات واضحة. كل محطة تفتح بعد سابقتها، وكل خطوة مشروحة للموبايل.
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
  Github,
  Rocket,
  KeyRound,
  PartyPopper,
  Check,
  Lock,
  Download,
  ExternalLink,
  Copy,
  Loader2,
  ChevronDown,
  PlayCircle,
  ShieldCheck,
  Database,
  Clock,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { issueTransferCodeAction, ownershipLiveAction, type OwnershipLive } from "@/server/actions/ownership";
import { GUIDES, type Guide } from "./guides";

type Props = {
  storeName: string;
  subdomain: string;
  active: boolean;
  githubEnabled: boolean;
  repo: string | null;
  github: { state: string | null; message: string | null };
  live: OwnershipLive;
  purgeAfter: string | null;
  purgedAt: string | null;
};

export function OwnershipCenter(props: Props) {
  const reduce = useReducedMotion();
  const [live, setLive] = useState(props.live);
  const owned = Boolean(live.ownedAt);
  const repo = props.repo;
  const [deployed, setDeployed] = useState(false);
  const [siteUrl, setSiteUrl] = useState(live.transfer?.siteUrl ?? "");

  // أثناء الاستلام نتابع الحالة من المنصة كل بضع ثوانٍ.
  const importing = live.transfer?.status === "importing" && !owned;
  useEffect(() => {
    if (owned || !live.transfer || live.transfer.status === "revoked") return;
    const iv = window.setInterval(async () => {
      const r = await ownershipLiveAction();
      if (r.ok) setLive(r.data);
    }, importing ? 4000 : 10000);
    return () => window.clearInterval(iv);
  }, [owned, importing, live.transfer]);

  useEffect(() => {
    if (props.github.state === "ok") toast.success("تم إنشاء مستودعك الخاص على GitHub ورفع كود متجرك إليه");
    else if (props.github.state === "updated") toast.success("رفعنا آخر إصدار لمستودعك. Vercel يعيد نشر متجرك الآن (دقيقتان تقريباً).");
    else if (props.github.state === "error") toast.error(props.github.message ?? "تعذّر ربط GitHub");
    else if (props.github.state === "denied") toast.error("لم تتم الموافقة على GitHub");
    else if (props.github.state === "expired") toast.error("انتهت مهلة الربط، أعد المحاولة");
  }, [props.github]);

  const step = owned ? 4 : !repo ? 1 : !deployed && !live.transfer ? 2 : 3;

  if (!props.active) return <Locked />;
  if (owned) return <Owned storeName={props.storeName} url={live.ownedUrl!} purgedAt={props.purgedAt} repo={repo} githubEnabled={props.githubEnabled} />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="dash-card relative overflow-hidden p-6">
        <div aria-hidden className="pointer-events-none absolute -end-16 -top-16 size-56 rounded-full bg-nova/25 blur-3xl" />
        <p className="text-[12px] font-black text-nova">امتلك متجرك للأبد</p>
        <h1 className="mt-1 text-2xl font-black text-ink">«{props.storeName}» على حساباتك أنت</h1>
        <p className="mt-2 max-w-xl text-[13px] leading-7 text-ink-2">
          متجرك ولوحة تحكمه بكل منتجاتك وطلباتك وعملائك ينتقلون لحساباتك المجانية على GitHub و Vercel و Neon. بلا اشتراك، وبلا أي مفاتيح لدينا.
          كل الخطوات تعمل من الموبايل، في نحو 10 دقائق.
        </p>
        <ol className="mt-5 grid grid-cols-4 gap-2" aria-label="مراحل الاستلام">
          {["الكود", "النشر", "الاستلام", "تم"].map((l, i) => (
            <li
              key={l}
              className={cn(
                "rounded-xl border px-2 py-2 text-center text-[11px] font-bold",
                i + 1 < step ? "border-emerald-400/30 text-emerald-600 dark:text-emerald-300" : i + 1 === step ? "border-nova/50 bg-nova/10 text-ink" : "border-edge/10 text-ink-3"
              )}
            >
              {i + 1 < step ? <Check className="mx-auto mb-0.5 size-3.5" /> : <span className="block tabular-nums">{i + 1}</span>}
              {l}
            </li>
          ))}
        </ol>
      </header>

      {/* 1) الكود على GitHub */}
      <Station n={1} icon={Github} title="كود متجرك في مستودعك الخاص" done={Boolean(repo)} open={step === 1} reduce={reduce}>
        {repo ? (
          <p className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
            <Check className="size-4 text-emerald-500" /> مستودعك الخاص جاهز:
            <a href={`https://github.com/${repo}`} target="_blank" rel="noreferrer" dir="ltr" className="font-bold text-nova">
              {repo}
            </a>
          </p>
        ) : (
          <p className="text-[13px] leading-7 text-ink-2">
            نولّد كود متجرك (المتجر ولوحة التحكم فقط، بتصميمك وألوانك وخطوطك)، وننشئه مستودعاً خاصاً في حساب GitHub الخاص بك بضغطة واحدة.
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          {props.githubEnabled ? <GithubButton update={Boolean(repo)} /> : null}
          <ZipButton />
        </div>
        <GuideBox guide={GUIDES.github} />
        <GuideBox guide={GUIDES.zip} />
      </Station>

      {/* 2) النشر على Vercel وربط القاعدة */}
      <Station n={2} icon={Rocket} title="انشره على Vercel واربط قاعدة البيانات" done={step > 2} open={step === 2} reduce={reduce} locked={!repo}>
        <GuideBox guide={GUIDES.vercel} defaultOpen />
        <GuideBox guide={GUIDES.neon} defaultOpen />
        {step === 2 ? (
          <button
            type="button"
            onClick={() => setDeployed(true)}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-nova to-nova-deep text-sm font-black text-white shadow-lg shadow-nova/30"
          >
            نشرته وربطت القاعدة <ArrowLeft className="size-4" />
          </button>
        ) : null}
      </Station>

      {/* 3) كود الاستلام */}
      <Station n={3} icon={KeyRound} title="استلم بيانات متجرك في موقعك الجديد" done={owned} open={step === 3} reduce={reduce} locked={step < 3}>
        <TransferStep siteUrl={siteUrl} onSiteUrl={setSiteUrl} live={live} />
        <GuideBox guide={GUIDES.uploadthing} />
        <GuideBox guide={GUIDES.groq} />
      </Station>

      <p className="flex items-start gap-2 rounded-2xl border border-edge/[0.07] p-4 text-[12px] leading-6 text-ink-3">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" />
        لا نطلب ولا نحفظ أي مفتاح لحساباتك. موقعك الجديد هو من يسحب بياناته بكود الاستلام، ثم يحوّل رابطك الحالي ({props.subdomain}) زوارك إليه تلقائياً،
        وتُحذف بيانات التجربة من Colapia بعد 72 ساعة.
      </p>
    </div>
  );
}

// ─── زر GitHub: الانتقال لـ GitHub ثم توليد المشروع ورفعه يستغرق ثواني طويلة، فنعرض شاشة مراحل لا تختفي
// حتى تنتقل الصفحة فعلاً (وتعود لحالتها إن رجع المستخدم بزر الرجوع).
const GITHUB_STAGES = ["نفتح GitHub لتوافق على إنشاء المستودع", "نولّد كود متجرك بتصميمه وبياناته", "ننشئ مستودعك الخاص ونرفع الملفات", "لحظات ونعود بك هنا"];
const UPDATE_STAGES = ["نفتح GitHub لتوافق على التحديث", "نولّد آخر إصدار من كود متجرك", "نرفع التحديث لمستودعك (تصميمك وبياناتك كما هي)", "لحظات ونعود بك هنا"];

function GithubButton({ update }: { update: boolean }) {
  const stages = update ? UPDATE_STAGES : GITHUB_STAGES;
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const reset = (e: PageTransitionEvent) => e.persisted && setBusy(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);
  useEffect(() => {
    if (!busy) return;
    setStage(0);
    const iv = window.setInterval(() => setStage((s) => Math.min(s + 1, stages.length - 1)), 3500);
    return () => window.clearInterval(iv);
  }, [busy, stages.length]);
  return (
    <>
      <a
        href={update ? "/api/ownership/github/start?mode=update" : "/api/ownership/github/start"}
        onClick={(e) => {
          if (busy) e.preventDefault();
          setBusy(true);
        }}
        aria-busy={busy}
        className={cn(
          "inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-ink text-sm font-black text-space shadow-lg transition hover:opacity-90",
          busy && "pointer-events-none opacity-80"
        )}
      >
        {busy ? <Loader2 className="size-4.5 animate-spin" /> : <Github className="size-4.5" />}
        {busy ? "جارٍ التجهيز..." : update ? "حدّث مستودعك لآخر إصدار" : "اربط GitHub وأنشئ المستودع"}
      </a>
      {busy ? (
        <div role="status" aria-live="polite" className="fixed inset-0 z-[80] grid place-items-center bg-space/70 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm dash-card rounded-3xl p-6 text-center shadow-2xl">
            <span className="relative mx-auto grid size-16 place-items-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-nova/20" />
              <span className="relative grid size-16 place-items-center rounded-full bg-ink text-space">
                <Github className="size-7" />
              </span>
            </span>
            <p className="mt-4 text-[15px] font-black text-ink">{update ? "نحدّث متجرك على GitHub" : "نجهّز مستودعك على GitHub"}</p>
            <ol className="mt-4 space-y-2 text-start">
              {stages.map((l, i) => (
                <li key={l} className={cn("flex items-center gap-2 text-[12.5px] transition", i <= stage ? "text-ink" : "text-ink-3")}>
                  {i < stage ? <Check className="size-4 text-emerald-500" /> : i === stage ? <Loader2 className="size-4 animate-spin text-nova" /> : <span className="size-4 rounded-full border border-edge/20" />}
                  {l}
                </li>
              ))}
            </ol>
            <p className="mt-4 text-[11.5px] leading-5 text-ink-3">لا تغلق الصفحة. قد يستغرق ذلك حتى دقيقة.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}

// ─── زر ZIP: نجلب الملف بأنفسنا لنعرض التقدم، ثم نحفظه باسمه.
function ZipButton() {
  const [state, setState] = useState<"idle" | "building" | "downloading">("idle");
  const [pct, setPct] = useState(0);
  const run = async () => {
    if (state !== "idle") return;
    setState("building");
    setPct(0);
    try {
      const res = await fetch("/api/ownership/zip", { cache: "no-store" });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "تعذّر تجهيز الملف، أعد المحاولة");
      }
      setState("downloading");
      const total = Number(res.headers.get("content-length")) || 0;
      const reader = res.body.getReader();
      const parts: BlobPart[] = [];
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value);
        got += value.length;
        if (total) setPct(Math.round((got / total) * 100));
      }
      const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "store.zip";
      const url = URL.createObjectURL(new Blob(parts, { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.success("تم تحميل مشروع متجرك");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر التحميل");
    } finally {
      setState("idle");
    }
  };
  return (
    <button
      type="button"
      onClick={run}
      disabled={state !== "idle"}
      aria-busy={state !== "idle"}
      className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-edge/10 text-sm font-bold text-ink-2 transition hover:bg-edge/[0.04] disabled:opacity-80"
    >
      {state === "idle" ? <Download className="size-4" /> : <Loader2 className="size-4 animate-spin" />}
      {state === "building" ? "نولّد مشروعك..." : state === "downloading" ? `يُحمَّل${pct ? ` ${pct}%` : "..."}` : "حمّل ملف ZIP (للكمبيوتر)"}
    </button>
  );
}

function TransferStep({ siteUrl, onSiteUrl, live }: { siteUrl: string; onSiteUrl: (v: string) => void; live: OwnershipLive }) {
  const [code, setCode] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const clean = useMemo(() => {
    try {
      const u = new URL(siteUrl.trim().startsWith("http") ? siteUrl.trim() : `https://${siteUrl.trim()}`);
      return u.protocol === "https:" || u.hostname === "localhost" ? u.origin : null;
    } catch {
      return null;
    }
  }, [siteUrl]);

  const t = live.transfer;
  const seen = t?.status === "importing" && t.lastSeenAt;

  return (
    <div className="space-y-4">
      <ol className="space-y-2 text-[13px] leading-7 text-ink-2">
        <li>
          <b className="text-nova">1.</b> اضغط «أصدر كود الاستلام» (صالح 7 أيام، ولمرة واحدة).
        </li>
        <li>
          <b className="text-nova">2.</b> الصق رابط موقعك الجديد من Vercel، ثم افتح صفحة الإعداد فيه؛ الكود يُنقل تلقائياً.
        </li>
        <li>
          <b className="text-nova">3.</b> اختر بريد وكلمة مرور لوحتك الجديدة، والصق مفتاحي UploadThing وGroq (كما نسختهما)، ثم «ابدأ الاستلام».
        </li>
      </ol>

      {code ? (
        <div className="rounded-2xl border border-nova/30 bg-nova/5 p-4">
          <p className="mb-2 text-[12px] font-bold text-ink">كود الاستلام (يظهر مرة واحدة)</p>
          <div className="flex items-center gap-2">
            <code dir="ltr" className="min-w-0 flex-1 truncate rounded-xl bg-edge/[0.06] px-3 py-2.5 font-mono text-[12px] text-ink">
              {code}
            </code>
            <button
              type="button"
              aria-label="نسخ الكود"
              onClick={() => navigator.clipboard.writeText(code).then(() => toast.success("نُسخ الكود"))}
              className="grid size-11 shrink-0 place-items-center rounded-xl border border-edge/10 text-ink-2"
            >
              <Copy className="size-4" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await issueTransferCodeAction();
              if (r.ok) setCode(r.data.code);
              else toast.error(r.error);
            })
          }
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-nova to-nova-deep text-sm font-black text-white shadow-lg shadow-nova/30 disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
          {t && t.status !== "revoked" ? "أصدر كوداً جديداً (يلغي السابق)" : "أصدر كود الاستلام"}
        </button>
      )}

      <label className="block space-y-1.5">
        <span className="text-[12.5px] font-bold text-ink">رابط موقعك الجديد</span>
        <input
          value={siteUrl}
          onChange={(e) => onSiteUrl(e.target.value)}
          dir="ltr"
          placeholder="https://your-store.vercel.app"
          className="w-full rounded-xl border border-edge/10 bg-edge/[0.03] px-3.5 py-3 text-[14px] text-ink outline-none focus:border-nova focus:ring-2 focus:ring-nova/20"
        />
      </label>
      <a
        href={clean ? `${clean}/setup${code ? `#code=${code}` : ""}` : undefined}
        target="_blank"
        rel="noreferrer"
        aria-disabled={!clean}
        className={cn(
          "inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border text-sm font-black transition",
          clean ? "border-nova/40 text-ink hover:bg-nova/10" : "pointer-events-none border-edge/10 text-ink-3 opacity-60"
        )}
      >
        افتح صفحة الإعداد في موقعك <ExternalLink className="size-4" />
      </a>

      {seen ? (
        <p className="flex items-center gap-2 rounded-xl bg-sky-400/10 px-3.5 py-2.5 text-[12.5px] text-sky-700 dark:text-sky-200" aria-live="polite">
          <Loader2 className="size-4 animate-spin" /> موقعك الجديد يستلم بياناتك الآن{t?.siteUrl ? ` (${new URL(t.siteUrl).host})` : ""}...
        </p>
      ) : null}
    </div>
  );
}

function Station({
  n,
  icon: Icon,
  title,
  done,
  open,
  locked,
  reduce,
  children,
}: {
  n: number;
  icon: typeof Github;
  title: string;
  done: boolean;
  open: boolean;
  locked?: boolean;
  reduce: boolean | null;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(open);
  useEffect(() => setExpanded(open), [open]);
  return (
    <section className={cn("dash-card overflow-hidden", open && "ring-1 ring-nova/30")}>
      <button
        type="button"
        onClick={() => !locked && setExpanded((e) => !e)}
        aria-expanded={expanded}
        disabled={locked}
        className="flex w-full items-center gap-3 p-5 text-start disabled:cursor-not-allowed"
      >
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl",
            done ? "bg-emerald-500 text-white" : locked ? "bg-edge/[0.06] text-ink-3" : "bg-nova/15 text-nova"
          )}
        >
          {done ? <Check className="size-5" strokeWidth={3} /> : locked ? <Lock className="size-4.5" /> : <Icon className="size-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold text-ink-3">الخطوة {n}</span>
          <span className={cn("block text-[15px] font-black", locked ? "text-ink-3" : "text-ink")}>{title}</span>
        </span>
        {!locked ? <ChevronDown className={cn("size-4 text-ink-3 transition", expanded && "rotate-180")} /> : null}
      </button>
      {expanded && !locked ? (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 border-t border-edge/[0.06] p-5"
        >
          {children}
        </motion.div>
      ) : null}
    </section>
  );
}

function GuideBox({ guide, defaultOpen = false }: { guide: Guide; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-edge/[0.08] bg-edge/[0.02]">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2 px-4 py-3 text-start">
        <span className="min-w-0 flex-1 text-[13px] font-bold text-ink">{guide.title}</span>
        <span className="inline-flex items-center gap-1 text-[11px] text-ink-3">
          <Clock className="size-3" /> {guide.minutes} د
        </span>
        <ChevronDown className={cn("size-4 text-ink-3 transition", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="space-y-3 border-t border-edge/[0.06] px-4 py-4">
          {guide.videoUrl ? (
            <div className="aspect-video overflow-hidden rounded-xl">
              <iframe src={guide.videoUrl} title={guide.title} className="size-full" allow="encrypted-media; picture-in-picture" allowFullScreen loading="lazy" />
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-[11.5px] text-ink-3">
              <PlayCircle className="size-3.5" /> فيديو الشرح قريباً، والخطوات التالية تكفي تماماً.
            </p>
          )}
          <ol className="space-y-2.5">
            {guide.steps.map((s, i) => (
              <li key={i} className="flex gap-2.5 text-[13px] leading-7 text-ink-2">
                <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-nova/15 text-[10.5px] font-black text-nova">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          {guide.tip ? <p className="rounded-xl bg-edge/[0.04] px-3 py-2 text-[12px] leading-6 text-ink-2">{guide.tip}</p> : null}
          {guide.link ? (
            <a href={guide.link.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-nova">
              {guide.link.label} <ExternalLink className="size-3.5" />
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Locked() {
  return (
    <div className="mx-auto max-w-xl dash-card p-8 text-center">
      <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-edge/[0.06] text-ink-3">
        <Lock className="size-6" />
      </span>
      <h1 className="text-xl font-black text-ink">امتلك متجرك بعد التفعيل</h1>
      <p className="mx-auto mt-2 max-w-sm text-[13px] leading-7 text-ink-2">
        بعد الدفعة الواحدة تستلم متجرك ولوحة تحكمه على حساباتك المجانية، ملكاً لك للأبد بلا أي اشتراك.
      </p>
      <Link href="/dashboard/billing" className="mt-5 inline-flex h-11 items-center gap-2 rounded-2xl bg-nova px-5 text-sm font-black text-white">
        فعّل متجرك <ArrowLeft className="size-4" />
      </Link>
    </div>
  );
}

function Owned({ storeName, url, purgedAt, repo, githubEnabled }: { storeName: string; url: string; purgedAt: string | null; repo: string | null; githubEnabled: boolean }) {
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  })();
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="dash-card p-8 text-center">
        <span className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-emerald-500 text-white shadow-2xl shadow-emerald-500/30">
          <PartyPopper className="size-7" />
        </span>
        <h1 className="text-2xl font-black text-ink">«{storeName}» الآن ملكك بالكامل</h1>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-7 text-ink-2">
          متجرك ولوحة تحكمه يعملان على حساباتك في <b dir="ltr">{host}</b>. رابطك القديم يحوّل زوارك إليه تلقائياً.
        </p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <a href={`${url}/dashboard`} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-nova to-nova-deep text-sm font-black text-white">
            لوحة تحكمك الجديدة <ExternalLink className="size-4" />
          </a>
          <a href={url} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-edge/10 text-sm font-bold text-ink-2">
            شاهد متجرك
          </a>
        </div>
        <p className="mt-6 flex items-center justify-center gap-2 text-[12px] text-ink-3">
          {purgedAt ? <Check className="size-3.5 text-emerald-500" /> : <Loader2 className="size-3.5 animate-spin" />}
          {purgedAt
            ? `حُذفت كل بيانات متجرك وصوره من Colapia (${new Date(purgedAt).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" })}).`
            : "نحذف الآن بيانات متجرك وصوره من Colapia؛ نسختك الوحيدة صارت عندك."}
        </p>
      </div>

      {repo && githubEnabled ? (
        <section className="dash-card space-y-3 p-6">
          <h2 className="flex items-center gap-2 text-[15px] font-black text-ink">
            <Rocket className="size-4.5 text-nova" /> تحديثات متجرك
          </h2>
          <p className="text-[13px] leading-7 text-ink-2">
            نطوّر المتجر ولوحة التحكم باستمرار. بضغطة نرفع آخر إصدار إلى مستودعك <b dir="ltr">{repo}</b>، وVercel يعيد نشره تلقائياً خلال دقيقتين.
            تصميمك وبياناتك ومفاتيحك لا تتغير.
          </p>
          <GithubButton update />
        </section>
      ) : null}

      <section className="dash-card space-y-3 p-6">
        <h2 className="flex items-center gap-2 text-[15px] font-black text-ink">
          <KeyRound className="size-4.5 text-nova" /> نسيت كلمة مرور لوحتك؟
        </h2>
        <ol className="space-y-2.5 text-[13px] leading-7 text-ink-2">
          <li className="flex gap-2.5">
            <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-nova/15 text-[10.5px] font-black text-nova">1</span>
            <span>
              افتح <b dir="ltr">{host}/login</b> واضغط «نسيت كلمة المرور»، ثم اكتب <b>كود الاسترجاع</b> الذي حفظته عند الاستلام وكلمة مرور جديدة.
              كود جديد يظهر لك بعدها في «الربط والمفاتيح».
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-nova/15 text-[10.5px] font-black text-nova">2</span>
            <span>
              ضاع كود الاسترجاع أيضاً؟ من حسابك على <b>Vercel</b>: مشروع متجرك ← Settings ← Environment Variables، أضف متغيراً اسمه
              <code dir="ltr" className="mx-1 rounded bg-edge/[0.07] px-1.5 py-0.5 text-[12px]">OWNER_RESET_CODE</code>
              وقيمته أي كلمة سرية من 12 حرفاً أو أكثر، ثم Deployments ← Redeploy. استخدمها مكان كود الاسترجاع في الخطوة 1، ثم احذف المتغير.
            </span>
          </li>
        </ol>
        <p className="rounded-xl bg-edge/[0.04] px-3 py-2 text-[12px] leading-6 text-ink-3">
          لا يستطيع أحد غيرك استرجاع لوحتك، ولا حتى Colapia: الدخول محفوظ في قاعدتك أنت، ومفتاح الطوارئ لا يضعه إلا صاحب حساب Vercel.
        </p>
      </section>
    </div>
  );
}
