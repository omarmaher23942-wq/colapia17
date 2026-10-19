"use client";

// HandoffPanel — رسائل التسليم الجاهزة في صفحة المحادثة (V3 A5): رابط الإعداد وطريقة الدخول، والدخول للوحة، والمتجر جاهز مع
// نصيحة البايو. لكل رسالة: نسخ بضغطة، وإرسال فوري عبر القناة نفسها (داخل نافذة الرد التي تسمح بها Meta). رسالة الإعداد بعد
// إرسالها أو تعليمها «أُرسلت» تبدأ التذكيرات ومهلة حذف المتجر غير المكتمل من لحظتها.
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, CheckCircle2, Copy, Mail, PackageCheck, Send } from "lucide-react";
import { markSetupDeliveredAction, sendHandoffMessageAction, sendSetupLinkNowAction } from "@/server/actions/platform-conv";

export type HandoffMsg = { kind: "setup" | "login" | "ready"; title: string; text: string };

export type HandoffInfo = {
  storeId: string;
  storeName: string;
  storeStatus: string;
  storeUrl: string;
  linkSentAt: string | null;
  /** أغلق الوكيل نفسه بعد الموافقة. */
  closedByAgent: boolean;
  messages: HandoffMsg[];
};

type Mode = "normal" | "human_agent" | "closed";

const BTN = "inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff]/60 disabled:opacity-40";
const GHOST = `${BTN} border-white/10 bg-white/[.04] text-[#c3cdf0] hover:bg-white/10 hover:text-[#eaf0ff]`;
const PRIMARY = `${BTN} border-[#6f86ff]/40 bg-[#6f86ff]/25 text-[#eaf0ff] hover:bg-[#6f86ff]/35`;

export function HandoffPanel({ conversationId, channel, mode, info }: { conversationId: string; channel: string; mode: Mode; info: HandoffInfo }) {
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState(info.linkSentAt);
  const channelName = channel === "instagram" ? "إنستجرام" : "ماسنجر";
  const inSetup = info.storeStatus === "setup";
  const visible = info.messages.filter((m) => (m.kind === "setup" ? inSetup : true));

  const copy = async (m: HandoffMsg) => {
    try {
      await navigator.clipboard.writeText(m.text);
      setCopied(m.kind);
      toast.success("نُسخت الرسالة");
      setTimeout(() => setCopied((k) => (k === m.kind ? null : k)), 2000);
    } catch {
      toast.error("تعذر النسخ؛ حدّدوا النص وانسخوه يدوياً");
    }
  };

  const send = (m: HandoffMsg) =>
    start(async () => {
      const r = await sendHandoffMessageAction(conversationId, m.kind);
      if ("error" in r && r.error) return void toast.error(r.error);
      if (m.kind === "setup") setSentAt((v) => v ?? new Date().toISOString());
      toast.success(`أُرسلت عبر ${channelName}${"tagged" in r && r.tagged ? " (بوسم الرد البشري)" : ""}`);
    });

  return (
    <section aria-labelledby="handoff-title" className="rounded-2xl border border-[#8fa8ff]/25 bg-[#6f86ff]/[0.07] p-3.5">
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <PackageCheck className="size-4 text-[#8fa8ff]" aria-hidden="true" />
        <h2 id="handoff-title" className="text-[13px] font-black text-[#eaf0ff]">
          التسليم: {info.storeName}
        </h2>
        <span className={`ms-auto rounded-md px-2 py-0.5 text-[10.5px] font-bold ${inSetup ? (sentAt ? "bg-emerald-500/15 text-emerald-200" : "bg-amber-500/15 text-amber-200") : "bg-white/10 text-[#c3cdf0]"}`}>
          {!inSetup ? "أكمل الإعداد" : sentAt ? `سُلِّم الرابط ${new Date(sentAt).toLocaleString("ar-EG-u-nu-latn", { dateStyle: "short", timeStyle: "short" })}` : "بانتظار التسليم"}
        </span>
      </header>
      {info.closedByAgent ? (
        <p className="mb-2.5 text-[11.5px] leading-6 text-[#c3cdf0]">وافق العميل فأغلق المساعد نفسه في هذه المحادثة نهائياً. المحادثة الآن لكم، ولن يُرسل أي شيء آلياً.</p>
      ) : null}
      {mode === "closed" ? (
        <p className="mb-2.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] leading-5 text-amber-200">مرّ أكثر من 7 أيام على آخر رسالة من العميل: الإرسال عبر {channelName} غير مسموح. انسخوا الرسالة وأرسلوها على واتساب.</p>
      ) : mode === "human_agent" ? (
        <p className="mb-2.5 text-[11px] leading-5 text-[#c3cdf0]/80">خارج نافذة 24 ساعة: الإرسال يتم بوسم الرد البشري (مسموح حتى 7 أيام من آخر رسالة للعميل).</p>
      ) : null}

      <div className="space-y-2.5">
        {visible.map((m) => (
          <article key={m.kind} className="rounded-xl border border-white/10 bg-[#07091a]/60 p-3">
            <h3 className="mb-1.5 text-[12px] font-bold text-[#eaf0ff]">{m.title}</h3>
            <p dir="auto" className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-[12px] leading-6 text-[#c3cdf0]">
              {m.text}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => copy(m)} className={GHOST}>
                {copied === m.kind ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
                {copied === m.kind ? "نُسخت" : "نسخ"}
              </button>
              <button type="button" disabled={pending || mode === "closed"} onClick={() => send(m)} className={PRIMARY}>
                <Send className="size-3.5" aria-hidden="true" /> إرسال الآن عبر {channelName}
              </button>
              {m.kind === "setup" && !sentAt ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await markSetupDeliveredAction(info.storeId);
                      if ("error" in r && r.error) return void toast.error(r.error);
                      setSentAt(new Date().toISOString());
                      toast.success("عُلِّم الرابط مُسلَّماً، وبدأت التذكيرات من الآن");
                    })
                  }
                  className={GHOST}
                >
                  <CheckCircle2 className="size-3.5" aria-hidden="true" /> أرسلتها بنفسي
                </button>
              ) : null}
              {m.kind === "setup" ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await sendSetupLinkNowAction(info.storeId);
                      if (r && "error" in r && r.error) return void toast.error(r.error);
                      setSentAt((v) => v ?? new Date().toISOString());
                      toast.success("أُرسل رابط الإعداد برسالة وبريد");
                    })
                  }
                  className={GHOST}
                  title="رسالة بزر الإعداد في المحادثة إن أمكن، وبريد على عنوان التاجر"
                >
                  <Mail className="size-3.5" aria-hidden="true" /> برسالة وبريد
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      <a href={info.storeUrl} target="_blank" rel="noopener" className="mt-2.5 inline-block text-[11px] font-bold text-[#8fa8ff] underline-offset-4 hover:underline">
        <bdi dir="ltr">{info.storeUrl.replace(/^https?:\/\//, "")}</bdi>
      </a>
    </section>
  );
}
