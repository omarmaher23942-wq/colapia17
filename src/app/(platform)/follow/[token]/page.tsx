// /follow/<token> — «متابعة متجرك»: مرحلة الطلب الحالية كما يحركها الفريق، وملاحظاته، والموعد الذي وعدنا به.
// للقراءة فقط برابط سري مشتق من معرّف الطلب (لا بيانات شخصية تظهر هنا غير اسم المتجر).
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Check, CircleDashed, MailCheck, PartyPopper } from "lucide-react";
import { ColapiaLogo } from "@/components/brand/ColapiaLogo";
import { AutoRefresh } from "@/components/platform/AutoRefresh";
import { FollowActions } from "@/components/intake/FollowActions";
import { findByTrackToken, isMissingTable, requestEvents, touch } from "@/intake/repo";
import { REQUEST_STAGES, STAGE_INFO, stageIndex } from "@/intake/stages";
import { agencyWhatsappUrl } from "@/intake/notify";
import { ContactHelp } from "@/components/intake/ContactHelp";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "متابعة متجرك | Colapia",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export const viewport: Viewport = { themeColor: "#07091a", colorScheme: "dark" };

const day = (d: Date) => new Intl.DateTimeFormat("ar-EG-u-nu-latn", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Cairo" }).format(d);
const when = (d: Date) => new Intl.DateTimeFormat("ar-EG-u-nu-latn", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "Africa/Cairo" }).format(d);

export default async function FollowPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  let row: Awaited<ReturnType<typeof findByTrackToken>> = null;
  let events: Awaited<ReturnType<typeof requestEvents>> = [];
  try {
    row = await findByTrackToken(token);
    if (row) {
      events = await requestEvents(row.id);
      await touch(row);
    }
  } catch (e) {
    if (!isMissingTable(e)) throw e;
  }
  if (!row) notFound();

  const isNew = sp.new === "1";
  // «تم تأكيد بريدك» تُعرض من حالة الطلب نفسها لا من ?confirmed=1 وحده (يستطيع أي أحد كتابته في الرابط).
  const confirmed = sp.confirmed === "1" && Boolean(row.emailConfirmedAt);
  const current = stageIndex(row.stage);
  const notesByStage = new Map<string, { note: string; at: Date }[]>();
  for (const e of events) {
    if ((e.type === "stage" || e.type === "note") && e.toStage && e.clientNote) notesByStage.set(e.toStage, [...(notesByStage.get(e.toStage) ?? []), { note: e.clientNote, at: e.createdAt }]);
  }
  const wa = agencyWhatsappUrl(`أهلاً، بخصوص طلب متجر «${row.storeName ?? ""}» (${row.code})`);
  const delivered = row.stage === "delivery";
  const overdue = !delivered && Boolean(row.etaTo) && row.etaTo!.getTime() < Date.now();
  const Name = isNew ? "h2" : "h1";

  return (
    <div dir="rtl" className="dash dark dash-cosmos relative min-h-dvh text-ink">
      <AutoRefresh everyMs={60_000} />
      <div className="sticky top-0 z-20 border-b border-edge/[0.06] bg-space/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-4">
          <ColapiaLogo size={28} priority />
        </div>
      </div>

      <main className="mx-auto max-w-2xl space-y-5 px-4 pb-16 pt-6 sm:pt-10">
        {isNew ? (
          <section className="dash-card space-y-3 border-emerald-400/25 p-5 sm:p-6">
            <span className="grid size-11 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-300">
              <PartyPopper className="size-5" aria-hidden="true" />
            </span>
            <h1 className="text-[24px] font-black leading-tight text-ink">وصلنا طلبك، شكراً لثقتك</h1>
            <p className="text-[14.5px] leading-7 text-ink-2">
              الفريق هيبدأ يراجع معلوماتك، ولو احتاج أي تفصيلة هيراسلك. <strong className="text-ink">احفظ رابط الصفحة دي</strong>: منها تتابع متجرك مرحلة بمرحلة.
              {row.email ? " وهنبعتلك نسخة منه على بريدك." : ""}
            </p>
            <FollowActions code={row.code} storeName={row.storeName ?? ""} />
          </section>
        ) : null}

        {confirmed ? (
          <p role="status" className="flex items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-3 text-[13.5px] font-bold text-emerald-200">
            <MailCheck className="size-4 shrink-0" aria-hidden="true" /> تم تأكيد بريدك. شكراً.
          </p>
        ) : null}

        <section className="dash-card space-y-2 p-5 sm:p-6">
          <p className="text-[12.5px] font-black text-nova-2">طلب {row.code}</p>
          <Name className="text-[24px] font-black leading-tight text-ink">{row.storeName || "متجرك"}</Name>
          {overdue ? (
            <p className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-[14px] font-bold leading-7 text-amber-200">
              اتأخرنا عن الموعد اللي قلناه لك. الفريق شغال على متجرك وهنبلغك أول ما يجهز.
            </p>
          ) : !delivered && row.etaFrom && row.etaTo ? (
            <p className="text-[14px] leading-7 text-ink-2">
              التسليم المتوقع بين <strong className="text-ink">{day(row.etaFrom)}</strong> و<strong className="text-ink">{day(row.etaTo)}</strong>، وممكن نخلّصه أسرع. والفريق بيراجع المتجر قبل ما يسلّمه لك.
            </p>
          ) : null}
        </section>

        <section className="dash-card p-5 sm:p-6" aria-label="مراحل تنفيذ المتجر">
          <ol className="relative space-y-6">
            {REQUEST_STAGES.map((s, i) => {
              const state = i < current ? "done" : i === current ? "now" : "next";
              const final = i === REQUEST_STAGES.length - 1;
              const notes = notesByStage.get(s) ?? [];
              return (
                <li key={s} aria-current={state === "now" ? "step" : undefined} className="relative flex gap-4">
                  {i < REQUEST_STAGES.length - 1 ? (
                    <span aria-hidden="true" className={cn("absolute start-[17px] top-10 h-[calc(100%-8px)] w-0.5", i < current ? "bg-nova/60" : "bg-edge/10")} />
                  ) : null}
                  <span
                    className={cn(
                      "relative z-10 grid size-9 shrink-0 place-items-center rounded-full border text-[13px] font-black",
                      state === "done" && "border-nova bg-nova text-white",
                      state === "now" && "border-nova bg-nova/15 text-nova-2 ring-4 ring-nova/15",
                      state === "next" && "border-edge/15 text-ink-3",
                    )}
                  >
                    {state === "done" || (state === "now" && final) ? <Check className="size-4" aria-hidden="true" /> : state === "now" ? <CircleDashed className="size-4 animate-spin motion-reduce:animate-none [animation-duration:3s]" aria-hidden="true" /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1 pt-1">
                    <p className={cn("text-[15px] font-black", state === "next" ? "text-ink-3" : "text-ink")}>
                      {STAGE_INFO[s].label}
                      {state === "done" ? <span className="sr-only"> (تمت)</span> : null}
                      {state === "now" ? <span className="ms-2 rounded-full bg-nova/15 px-2 py-0.5 text-[11.5px] text-nova-2">{final ? "تم" : "دلوقتي"}</span> : null}
                    </p>
                    {state !== "next" ? <p className="mt-1 text-[13.5px] leading-7 text-ink-2">{STAGE_INFO[s].client}</p> : null}
                    {notes.map((n) => (
                      <p key={n.at.toISOString()} className="mt-2 rounded-xl border border-edge/10 bg-edge/[0.04] p-3 text-[13.5px] leading-7 text-ink">
                        <span className="block text-[11.5px] font-bold text-ink-3">من الفريق · {when(n.at)}</span>
                        {n.note}
                      </p>
                    ))}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="space-y-2 px-1 text-[13px] leading-7 text-ink-3">
          <p>عند التسليم هيوصلك رابط متجرك وطريقة الدخول للوحة التحكم، وهنشرح لك وقتها خطوات التجربة والتفعيل.</p>
          <p className="font-bold text-ink-2">عندك سؤال؟</p>
          <ContactHelp whatsappUrl={wa} />
        </section>
      </main>
    </div>
  );
}
