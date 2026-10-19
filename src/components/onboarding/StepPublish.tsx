"use client";

// StepPublish — فحص الجاهزية ثم «تفعيل المتجر» ← شاشة «جارٍ تطبيق الإعدادات» ← «مبروك، متجركم جاهز».
// الفحص يُعاد على الخادم عند التفعيل، فلا تُفعَّل بيانات ناقصة مهما فعلت الواجهة.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, LayoutDashboard, Rocket, X } from "lucide-react";
import QRCode from "qrcode";
import { publishStoreAction, readinessAction } from "@/server/actions/setup";
import type { ReadinessItem, StepId } from "@/lib/onboarding";
import { cn } from "@/lib/utils";
import { btnGhost, btnPrimary, Notice, Spinner } from "./ui";

type Phase = "check" | "applying" | "done";

export function StepPublish({ initial, inspection: initialInspection, onBack, onGoto, onPublished }: { initial: ReadinessItem[]; inspection: boolean; onBack: () => void; onGoto: (s: StepId) => void; onPublished: () => void }) {
  const [items, setItems] = useState(initial);
  const [inspection, setInspection] = useState(initialInspection);
  const [phase, setPhase] = useState<Phase>("check");
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<{ url: string; host: string } | null>(null);
  const blockers = items.filter((i) => !i.ok);

  useEffect(() => {
    let live = true;
    void readinessAction().then((r) => {
      if (live && r.ok) {
        setItems(r.items);
        setInspection(r.inspection);
      }
    });
    return () => {
      live = false;
    };
  }, []);

  const busy = useRef(false);
  async function publish() {
    // نقرة ثانية قبل أن تنتقل الشاشة كانت تطلق تفعيلاً آخر.
    if (busy.current) return;
    busy.current = true;
    try {
      await runPublish();
    } finally {
      busy.current = false;
    }
  }
  async function runPublish() {
    setErr(null);
    const fresh = await readinessAction();
    if (fresh.ok) {
      setItems(fresh.items);
      if (!fresh.ready) return setErr("أكملوا النقاط الموضحة أدناه ثم فعّلوا المتجر.");
    }
    setPhase("applying");
    // وقت أدنى لعرض الشاشة كي لا تومض، والتفعيل الفعلي على الخادم.
    const [r] = await Promise.all([publishStoreAction(), new Promise((ok) => setTimeout(ok, 2200))]);
    if (!r.ok) {
      setPhase("check");
      if (r.blockers) setItems((cur) => cur.map((i) => (r.blockers!.some((b) => b.id === i.id) ? { ...i, ok: false } : i)));
      return setErr(r.error);
    }
    setRes({ url: r.url, host: r.host });
    setPhase("done");
    onPublished();
  }

  if (phase === "applying") return <Applying />;
  if (phase === "done" && res) return <Celebration url={res.url} host={res.host} />;

  return (
    <div className="space-y-5">
      <ul className="dash-card divide-y divide-edge/10" aria-label="جاهزية المتجر">
        {items.map((i) => (
          <li key={i.id} className="flex items-start gap-3 p-4">
            <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full", i.ok ? "bg-ok/15 text-ok" : "bg-warn/15 text-warn")}>
              {i.ok ? <Check className="size-3.5" strokeWidth={3} aria-hidden="true" /> : <X className="size-3.5" strokeWidth={3} aria-hidden="true" />}
              <span className="sr-only">{i.ok ? "جاهز" : "ناقص"}</span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-black text-ink">{i.label}</p>
              {!i.ok ? <p className="mt-0.5 text-[12.5px] leading-6 text-ink-2">{i.hint}</p> : null}
            </div>
            {!i.ok ? (
              <button type="button" onClick={() => onGoto(i.step)} className={cn(btnGhost, "min-h-10 shrink-0")}>
                إكمال
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="dash-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-[12px] font-bold text-ink-3">المعاينة وفتح الشحنة قبل الدفع</p>
          <p className="text-[14px] font-black text-ink">{inspection ? "مسموحة: يعاين الزبون الشحنة قبل أن يدفع" : "غير مسموحة: الدفع قبل فتح الشحنة"}</p>
        </div>
        <button type="button" onClick={() => onGoto("payment")} className={cn(btnGhost, "min-h-10 shrink-0")}>
          تغيير
        </button>
      </div>

      {err ? <Notice tone="bad">{err}</Notice> : null}
      {!blockers.length ? <Notice tone="ok">كل شيء جاهز. عند التفعيل يبدأ متجركم باستقبال الزوار والطلبات، وتبدأ فترة التجربة.</Notice> : null}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void publish()} className={cn(btnPrimary, "min-h-12 px-7 text-[14.5px]")}>
          <Rocket className="size-4" aria-hidden="true" />
          تفعيل المتجر
        </button>
        <button type="button" onClick={onBack} className={btnGhost}>
          رجوع
        </button>
      </div>
      <p className="text-[12px] leading-5 text-ink-3">يمكنكم تعديل كل ما أعددتموه لاحقاً من لوحة التحكم.</p>
    </div>
  );
}

// ─── «جارٍ تطبيق الإعدادات» ──────────────────────────────────────────────────
function Applying() {
  return (
    <div role="status" aria-live="polite" className="fixed inset-0 z-[80] grid place-items-center bg-space p-6">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-6 grid size-16 place-items-center rounded-2xl bg-nova/12">
          <span className="size-7 animate-spin rounded-full border-[3px] border-nova/25 border-t-nova motion-reduce:animate-none" aria-hidden="true" />
        </div>
        <h2 className="text-[20px] font-black text-ink">جارٍ تطبيق الإعدادات</h2>
        <p className="mt-1.5 text-[13px] text-ink-3">لحظات ويكون متجركم جاهزاً.</p>
        <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-edge/10" aria-hidden="true">
          <div className="h-full origin-right animate-[apply-bar_2.4s_ease-out_forwards] rounded-full bg-nova motion-reduce:animate-none motion-reduce:w-3/4" />
        </div>
        <style>{`@keyframes apply-bar{from{width:6%}to{width:92%}}`}</style>
      </div>
    </div>
  );
}

// ─── «مبروك، متجركم جاهز» ────────────────────────────────────────────────────
function Celebration({ url, host }: { url: string; host: string }) {
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState<"link" | "caption" | null>(null);
  const ran = useRef(false);
  const caption = `متجرنا صار على الإنترنت. تفضلوا بالزيارة والطلب مباشرة من الرابط: ${url}`;

  useEffect(() => {
    void QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: "#0d1330", light: "#ffffff" } }).then(setQr).catch(() => null);
    if (ran.current) return;
    ran.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    void import("canvas-confetti").then(({ default: confetti }) => {
      const colors = ["#4f63f0", "#7c3aed", "#14b8a6", "#f59e0b", "#ec4899"];
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.35 }, colors, disableForReducedMotion: true });
      setTimeout(() => confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0, y: 0.5 }, colors, disableForReducedMotion: true }), 260);
      setTimeout(() => confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1, y: 0.5 }, colors, disableForReducedMotion: true }), 420);
    });
  }, [url]);

  async function copy(text: string, what: "link" | "caption") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* النسخ غير متاح: الرابط ظاهر ليُنسخ يدوياً */
    }
  }

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-space">
      <div className="mx-auto flex min-h-full max-w-xl flex-col items-center px-5 py-10 text-center">
        <div className="grid size-16 place-items-center rounded-full bg-ok/15 text-ok motion-safe:animate-[pop_.5s_ease-out]">
          <Check className="size-8" strokeWidth={3} aria-hidden="true" />
        </div>
        <style>{`@keyframes pop{0%{transform:scale(.4);opacity:0}70%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}`}</style>
        <h1 className="mt-5 text-[28px] font-black text-ink">مبروك، متجركم جاهز</h1>
        <p className="mt-2 text-[14px] leading-7 text-ink-2">أصبح متجركم مفتوحاً للزوار والطلبات. هذا رابطه، شاركوه مع أول زبائنكم.</p>

        <div className="dash-card mt-6 flex w-full items-center gap-2 p-2.5 ps-4">
          <span dir="ltr" className="min-w-0 flex-1 truncate text-start text-[14px] font-black text-ink">
            {host}
          </span>
          <button type="button" onClick={() => void copy(url, "link")} className={cn(btnGhost, "min-h-10 shrink-0")}>
            {copied === "link" ? <Check className="size-4 text-ok" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
            {copied === "link" ? "تم النسخ" : "نسخ"}
          </button>
        </div>

        <div className="mt-4 grid w-full gap-2 sm:grid-cols-2">
          <a href={url} target="_blank" rel="noreferrer" className={cn(btnPrimary, "min-h-12")}>
            <ExternalLink className="size-4" aria-hidden="true" />
            زيارة المتجر
          </a>
          <Link href="/dashboard" className={cn(btnGhost, "min-h-12")}>
            <LayoutDashboard className="size-4" aria-hidden="true" />
            لوحة التحكم
          </Link>
        </div>

        <section className="dash-card mt-8 w-full p-5 text-start" aria-labelledby="bio-guide">
          <h2 id="bio-guide" className="text-[15px] font-black text-ink">
            ضعوا رابط متجركم في بايو إنستجرام
          </h2>
          <ol className="mt-4 space-y-4">
            {[
              ["افتحوا حسابكم واضغطوا «تعديل الملف الشخصي»", "من صفحة الحساب في تطبيق إنستجرام."],
              ["اختاروا «الروابط» ثم «إضافة رابط»", "ثم «إضافة رابط خارجي»."],
              ["الصقوا رابط متجركم واحفظوا", "اكتبوا عنواناً قصيراً مثل: تسوّقوا الآن."],
            ].map(([t, d], i) => (
              <li key={t} className="flex items-start gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-nova/12 text-[13px] font-black text-nova-2">{i + 1}</span>
                <div>
                  <p className="text-[13.5px] font-black text-ink">{t}</p>
                  <p className="text-[12.5px] text-ink-3">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="dash-card mt-4 grid w-full gap-4 p-5 text-start sm:grid-cols-[auto_1fr]" aria-labelledby="share-kit">
          <div className="mx-auto">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt={`رمز QR لرابط المتجر ${host}`} width={132} height={132} className="size-32 rounded-xl border border-edge/10 bg-white p-1.5" />
            ) : (
              <div className="grid size-32 place-items-center rounded-xl bg-edge/[0.05]">
                <Spinner />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h2 id="share-kit" className="text-[15px] font-black text-ink">
              شاركوه الآن
            </h2>
            <p className="mt-1 rounded-xl bg-edge/[0.04] p-3 text-[12.5px] leading-6 text-ink-2">{caption}</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button type="button" onClick={() => void copy(caption, "caption")} className={cn(btnGhost, "min-h-10")}>
                {copied === "caption" ? <Check className="size-4 text-ok" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                {copied === "caption" ? "تم النسخ" : "نسخ النص"}
              </button>
              <Link href="/dashboard/marketing" className={cn(btnGhost, "min-h-10")}>
                صور الستوري والبوست الجاهزة
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
