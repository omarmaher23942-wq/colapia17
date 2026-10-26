"use client";

// ConnectAccounts — قائمة «ربط حساباتكم»: لكل حساب شرح بسيط وحقل لصق. القيمة المحفوظة لا تُعرض مرة أخرى (حالة «محفوظ» فقط).
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { saveConnectionAction, startTransferAction } from "@/server/actions/connections";
import type { ConnectionView, SecretField } from "@/lib/connections";

const input = "min-h-11 w-full rounded-xl border border-edge/15 bg-transparent px-3 text-[13.5px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50";
const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-nova px-4 text-[13px] font-black text-white disabled:opacity-50 dark:text-space";
const ghost = "inline-flex min-h-11 items-center justify-center rounded-xl border border-edge/15 px-4 text-[13px] font-bold text-ink-2 hover:text-ink";

function Status({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[12px] font-bold ${ok ? "text-ok" : "text-ink-3"}`}>
      {ok ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <Circle className="size-4" aria-hidden="true" />}
      {text}
    </span>
  );
}

function SecretRow({ field, label, hint, placeholder, saved }: { field: SecretField; label: string; hint?: string; placeholder: string; saved: boolean }) {
  const [v, setV] = useState("");
  const [done, setDone] = useState(saved);
  const [pending, start] = useTransition();
  const id = `cx-${field}`;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-[13px] font-bold text-ink">
          {label}
        </label>
        <Status ok={done} text={done ? "محفوظ" : "لم يُضف"} />
      </div>
      {hint ? <p className="text-[12px] leading-5 text-ink-3">{hint}</p> : null}
      <div className="flex gap-2">
        <input id={id} type="password" autoComplete="off" dir="ltr" value={v} onChange={(e) => setV(e.target.value)} placeholder={done ? "ألصقوا قيمة جديدة للاستبدال" : placeholder} className={input} />
        <button
          type="button"
          disabled={pending || !v.trim()}
          className={btn}
          onClick={() =>
            start(async () => {
              const r = await saveConnectionAction(field, v).catch(() => ({ ok: false as const, error: "انقطع الاتصال." }));
              if (!r.ok) {
                toast.error(r.error);
                return;
              }
              setV("");
              setDone(true);
              toast.success("تم الحفظ مشفراً");
            })
          }
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          حفظ
        </button>
      </div>
    </div>
  );
}

export function ConnectAccounts({ view, meetingHref }: { view: ConnectionView; meetingHref: string | null }) {
  const [pending, start] = useTransition();
  const s = view.saved;
  return (
    <div className="space-y-6">
      <section className="dash-card space-y-4 p-4 sm:p-5">
        <h2 className="text-[15px] font-black text-ink">قاعدة البيانات (Neon)</h2>
        <p className="text-[12.5px] leading-6 text-ink-3">أنشئوا حساباً مجانياً على neon.tech ومشروعاً جديداً، ثم انسخوا رابط الاتصال (Connection string) والصقوه هنا. تُنسخ إليه كل بيانات متجركم ويصبح المتجر يعمل منه.</p>
        <SecretRow field="neonUrl" label="رابط القاعدة" placeholder="postgresql://…" saved={s.neonUrl} />
        <button
          type="button"
          disabled={pending || !s.neonUrl}
          className={ghost}
          onClick={() =>
            start(async () => {
              const r = await startTransferAction().catch(() => ({ ok: false as const, error: "انقطع الاتصال." }));
              if (r.ok) toast.success("بدأ نقل البيانات");
              else toast.info(r.error);
            })
          }
        >
          {pending ? <Loader2 className="ms-1 size-4 animate-spin" aria-hidden="true" /> : null}
          نقل البيانات
        </button>
      </section>

      <section className="dash-card space-y-4 p-4 sm:p-5">
        <h2 className="text-[15px] font-black text-ink">مفتاح القراءة الذكية (Groq)</h2>
        <p className="text-[12.5px] leading-6 text-ink-3">من console.groq.com ← API Keys ← إنشاء مفتاح، ثم الصقوه هنا. يخدم ميزات مثل البحث بالصورة في متجركم.</p>
        <SecretRow field="groqKey" label="مفتاح Groq" placeholder="gsk_…" saved={s.groqKey} />
      </section>

      <section className="dash-card space-y-4 p-4 sm:p-5">
        <h2 className="text-[15px] font-black text-ink">استضافة الصور (ImageKit)</h2>
        <p className="text-[12.5px] leading-6 text-ink-3">من imagekit.io ← Developer options: انسخوا العنوان (URL endpoint) والمفتاحين العام والخاص.</p>
        <SecretRow field="imagekitEndpoint" label="العنوان (URL endpoint)" placeholder="https://ik.imagekit.io/…" saved={s.imagekitEndpoint} />
        <SecretRow field="imagekitPublic" label="المفتاح العام" placeholder="public_…" saved={s.imagekitPublic} />
        <SecretRow field="imagekitPrivate" label="المفتاح الخاص" placeholder="private_…" saved={s.imagekitPrivate} />
      </section>

      <section className="dash-card space-y-3 p-4 sm:p-5">
        <h2 className="text-[15px] font-black text-ink">يضبطها الفريق معكم</h2>
        <div className="flex items-center justify-between gap-2 text-[13px]">
          <span>مستودع الكود (GitHub){view.team.github.username ? ` — ${view.team.github.username}${view.team.github.repo ? `/${view.team.github.repo}` : ""}` : ""}</span>
          <Status ok={view.team.github.status === "ready"} text={view.team.github.status === "ready" ? "جاهز" : "قيد التجهيز"} />
        </div>
        <div className="flex items-center justify-between gap-2 text-[13px]">
          <span>النشر (Cloudflare)</span>
          <Status ok={view.team.cloudflare.status === "ready"} text={view.team.cloudflare.status === "ready" ? "جاهز" : "قيد التجهيز"} />
        </div>
      </section>

      {meetingHref ? (
        <a href={meetingHref} target="_blank" rel="noopener noreferrer" className={btn}>
          احجزوا الميتنج
        </a>
      ) : (
        <p className="text-[12.5px] text-ink-3">لحجز الميتنج راسلونا في المحادثة نفسها.</p>
      )}
    </div>
  );
}
