"use client";

// LaunchBoard.tsx — عرض فحوص جاهزية الإطلاق (مجموعات بحالة وسبب وخطوة إصلاح)، وأزرار الاختبار الحي، وآخر أخطاء
// الذكاء الاصطناعي. «أعد الفحص» يعيد تحميل الصفحة فتُجرى الفحوص من جديد على الخادم.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, CircleSlash, ImageUp, Loader2, Mail, MessageCircle, RefreshCw, ScanSearch, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { CheckGroup, CheckStatus } from "@/server/launch-checks";
import type { ProbeResult } from "@/ai/providers";
import { cleanupMediaTestAction, resetModelsAction, sendTestEmailAction, testChatAction, testMediaAction, testVisionAction } from "@/server/actions/launch";
import { cn } from "@/lib/utils";

const ICON: Record<CheckStatus, { Icon: typeof CheckCircle2; tone: string; label: string }> = {
  ok: { Icon: CheckCircle2, tone: "text-emerald-300", label: "يعمل" },
  warn: { Icon: AlertTriangle, tone: "text-amber-300", label: "تنبيه" },
  fail: { Icon: XCircle, tone: "text-rose-300", label: "مشكلة" },
  skip: { Icon: CircleSlash, tone: "text-[#8d97c4]", label: "غير مفعّل" },
};

type Failure = { at: string; purpose: string; provider: string; model: string; error: string | null };

const PURPOSE: Record<string, string> = {
  visual_search_read: "البحث بالصورة (قراءة)",
  visual_search_compare: "البحث بالصورة (مقارنة)",
  closer: "وكيل الرسائل",
  outreach_opener: "رسالة التواصل",
  verify_payment: "فحص إيصال",
};

export function LaunchBoard({ groups, failures }: { groups: CheckGroup[]; failures: Failure[] }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [probe, setProbe] = useState<{ tier: "visionFast" | "chat"; results: ProbeResult[] } | null>(null);
  const [busy, setBusy] = useState<"vision" | "chat" | "reset" | "email" | "media" | null>(null);
  const [media, setMedia] = useState<{ state: "ok" | "broken"; url: string; host: string } | null>(null);

  /** يرفع صورة حقيقية ثم يعرضها في المتصفح من رابطها العام: الرفع وحده لا يكفي، العرض هو ما يراه الزائر. */
  const testMedia = async () => {
    setBusy("media");
    setMedia(null);
    const r = await testMediaAction().catch(() => ({ ok: false as const, error: "تعذر الاختبار" }));
    if (!r.ok) {
      setBusy(null);
      return void toast.error(r.error);
    }
    const loaded = await new Promise<boolean>((resolve) => {
      const img = new Image();
      const t = setTimeout(() => resolve(false), 12_000);
      img.onload = () => (clearTimeout(t), resolve(img.naturalWidth > 0));
      img.onerror = () => (clearTimeout(t), resolve(false));
      img.src = r.url;
    });
    setMedia({ state: loaded ? "ok" : "broken", url: r.url, host: r.host });
    await cleanupMediaTestAction(r.key).catch(() => null);
    setBusy(null);
    toast[loaded ? "success" : "error"](loaded ? "الرفع والعرض يعملان" : "رُفعت الصورة لكن المتصفح لم يستطع عرضها: التفاصيل تحت الأزرار");
  };

  const test = async (tier: "visionFast" | "chat") => {
    setBusy(tier === "chat" ? "chat" : "vision");
    const r = await (tier === "chat" ? testChatAction() : testVisionAction()).catch(() => ({ ok: false as const, error: "تعذر الاختبار" }));
    setBusy(null);
    if (!r.ok) return void toast.error(r.error);
    setProbe({ tier, results: r.results });
    const any = r.results.some((x) => x.ok);
    const what = tier === "chat" ? "المحادثة" : "قراءة الصور";
    toast[any ? "success" : "error"](any ? `نموذج ${what} واحد على الأقل يعمل` : `كل نماذج ${what} فشلت: السبب تحت كل نموذج`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => startRefresh(() => router.refresh())} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 px-4 text-[13px] font-black">
          {refreshing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-4" aria-hidden="true" />} أعد الفحص
        </button>
        <button type="button" disabled={busy !== null} onClick={() => test("visionFast")} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#8fa8ff] px-4 text-[13px] font-black text-[#07091a] disabled:opacity-50">
          {busy === "vision" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ScanSearch className="size-4" aria-hidden="true" />} اختبر البحث بالصورة
        </button>
        <button type="button" disabled={busy !== null} onClick={() => test("chat")} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 px-4 text-[13px] font-black disabled:opacity-50">
          {busy === "chat" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <MessageCircle className="size-4" aria-hidden="true" />} اختبر وكيل الرسائل
        </button>
        <button type="button" disabled={busy !== null} onClick={testMedia} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 px-4 text-[13px] font-black disabled:opacity-50">
          {busy === "media" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ImageUp className="size-4" aria-hidden="true" />} اختبر رفع الصور وعرضها
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={async () => {
            setBusy("email");
            const r = await sendTestEmailAction().catch(() => ({ ok: false, error: "تعذر الإرسال" }) as { ok: boolean; error?: string; to?: string });
            setBusy(null);
            r.ok ? toast.success(`أُرسل إلى ${r.to}. افتح بريدك (وصندوق الرسائل غير المرغوبة).`) : toast.error(r.error ?? "تعذر الإرسال");
          }}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 px-4 text-[13px] font-black disabled:opacity-50"
        >
          {busy === "email" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Mail className="size-4" aria-hidden="true" />} أرسل لي بريد تجربة
        </button>
      </div>

      {media ? (
        <section className={cn("rounded-3xl border p-5 text-[13px]", media.state === "ok" ? "border-emerald-400/30 bg-emerald-500/5" : "border-rose-400/40 bg-rose-500/5")} aria-live="polite">
          {media.state === "ok" ? (
            <p className="font-bold text-emerald-200">الرفع والعرض يعملان: حُفظت الصورة وعُرضت من <span dir="ltr" className="font-mono">{media.host}</span>.</p>
          ) : (
            <div className="space-y-1.5 text-rose-100">
              <p className="font-bold">حُفظت الصورة لكن المتصفح لم يستطع عرضها من <span dir="ltr" className="font-mono">{media.host}</span>.</p>
              <p>غالباً الطلب لا يصل إلى مكانه الصحيح: تأكد أن لـ <span dir="ltr" className="font-mono">{media.host}</span> سجل DNS بسحابة برتقالية (يكفي سجل <span dir="ltr" className="font-mono">*</span> العام)، وأن مسار <span dir="ltr" className="font-mono">*.colapia.com/*</span> يشير إلى Worker المنصة، فهو من يخدم الصور من R2. وإن ضبطت <span dir="ltr" className="font-mono">MEDIA_BASE_URL</span> فتأكد أنه نطاق يصل إلى الصور فعلاً.</p>
            </div>
          )}
        </section>
      ) : null}

      {probe ? (
        <section className="rounded-3xl border border-white/10 bg-[#0b0f2a] p-5" aria-live="polite">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-black">{probe.tier === "chat" ? "نماذج المحادثة (بالترتيب الذي يجربه وكيل الرسائل)" : "نماذج قراءة الصور (بالترتيب الذي يجربه المتجر)"}</h2>
            <button
              type="button"
              disabled={busy !== null}
              onClick={async () => {
                setBusy("reset");
                await resetModelsAction(probe.tier).catch(() => null);
                setBusy(null);
                toast.success("فُك الإيقاف المؤقت: ستُجرَّب كل النماذج في الطلب التالي");
              }}
              className="text-[12px] font-bold text-[#8fa8ff] underline-offset-4 hover:underline"
            >
              فك الإيقاف المؤقت عن النماذج
            </button>
          </div>
          <ul className="space-y-2">
            {probe.results.map((v) => (
              <li key={v.model} className="rounded-2xl border border-white/10 p-3 text-[13px]">
                <p className="flex flex-wrap items-center gap-2 font-bold">
                  {v.ok ? <CheckCircle2 className="size-4 text-emerald-300" aria-hidden="true" /> : <XCircle className="size-4 text-rose-300" aria-hidden="true" />}
                  <span dir="ltr" className="font-mono text-[12px]">{v.model}</span>
                  <span className="text-[11px] text-[#8d97c4]">{v.ms}ms</span>
                </p>
                <p dir="auto" className={cn("mt-1 break-words text-[12px]", v.ok ? "text-[#c3cdf0]" : "text-rose-200")}>{v.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {groups.map((g) => (
        <section key={g.title} className="rounded-3xl border border-white/10 bg-[#0b0f2a] p-5">
          <h2 className="mb-3 text-sm font-black">{g.title}</h2>
          <ul className="divide-y divide-white/5">
            {g.checks.map((c) => {
              const s = ICON[c.status];
              return (
                <li key={c.id} className="flex gap-3 py-3">
                  <s.Icon className={cn("mt-0.5 size-5 shrink-0", s.tone)} aria-label={s.label} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-black">{c.label}</p>
                    <p dir="auto" className="mt-0.5 whitespace-pre-line break-words text-[12.5px] text-[#c3cdf0]">{c.detail}</p>
                    {c.fix && c.status !== "ok" ? <p className="mt-1 text-[12px] text-amber-200/90">الحل: {c.fix}</p> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section className="rounded-3xl border border-white/10 bg-[#0b0f2a] p-5">
        <h2 className="mb-1 text-sm font-black">آخر أخطاء الذكاء الاصطناعي</h2>
        <p className="mb-3 text-[12px] text-[#8d97c4]">نص الخطأ كما أعاده المزوّد. الخطأ في نموذج ثم نجاح التالي لا يظهر للعميل؛ تكرار الخطأ في كل النماذج هو ما يعطل الميزة.</p>
        {failures.length ? (
          <ul className="space-y-2">
            {failures.map((f, i) => (
              <li key={i} className="rounded-2xl border border-white/10 p-3 text-[12.5px]">
                <p className="flex flex-wrap items-center gap-x-2 font-bold">
                  {PURPOSE[f.purpose] ?? f.purpose}
                  <span dir="ltr" className="font-mono text-[11px] text-[#8d97c4]">{f.provider}:{f.model}</span>
                  <span className="text-[11px] text-[#8d97c4]">{f.at}</span>
                </p>
                <p dir="auto" className="mt-1 break-words text-rose-200">{f.error ?? "بلا نص"}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-[#c3cdf0]">لا أخطاء مسجلة.</p>
        )}
      </section>
    </div>
  );
}
