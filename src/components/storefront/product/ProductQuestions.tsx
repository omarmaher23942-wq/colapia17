"use client";

// ProductQuestions — أسئلة وأجوبة المنتج: الأسئلة المجاب عنها فقط، ونموذج لسؤال جديد يصل التاجر ويظهر بعد إجابته.
import { useState, useTransition } from "react";
import { Check, Loader2, MessageCircleQuestion } from "lucide-react";
import { arCount } from "@/lib/format";
import { askProductQuestionAction } from "@/server/actions/product-page";
import { QUESTION_MAX } from "@/lib/pdp";

export type QA = { id: string; question: string; answer: string | null; askerName: string | null };
const QUESTION_NOUN = { one: "سؤال واحد", two: "سؤالان", few: "أسئلة", many: "سؤالاً", other: "سؤال" };

export function ProductQuestions({ subdomain, productId, items }: { subdomain: string; productId: string; items: QA[] }) {
  const [question, setQuestion] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  return (
    <section className="mt-14 border-t pt-10" style={{ borderColor: "var(--border)" }} aria-labelledby="qa-title">
      <h2 id="qa-title" className="font-heading text-xl font-black">
        أسئلة وأجوبة{items.length ? <span className="ms-2 text-sm font-bold opacity-60">({arCount(items.length, QUESTION_NOUN)})</span> : null}
      </h2>
      <div className="mt-6 grid gap-8 md:grid-cols-[1fr_340px]">
        <div>
          {items.length ? (
            <ul className="space-y-3">
              {items.map((q) => (
                <li key={q.id} className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                  <p className="text-sm font-black">{q.question}</p>
                  {q.askerName ? <p className="mt-0.5 text-[12px] opacity-60">{q.askerName}</p> : null}
                  <p className="mt-2 text-sm leading-7 opacity-85">{q.answer}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm opacity-70">لا توجد أسئلة مجاب عنها بعد. اطرحوا سؤالكم وسيصلكم الرد من المتجر.</p>
          )}
        </div>

        {sent ? (
          <p className="flex items-start gap-2 self-start rounded-2xl p-4 text-sm font-bold" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)" }} role="status">
            <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> وصل سؤالكم إلى المتجر، وسيظهر هنا بعد الرد عليه.
          </p>
        ) : (
          <form
            className="space-y-2.5 self-start rounded-2xl border p-4"
            style={{ borderColor: "var(--border)" }}
            onSubmit={(e) => {
              e.preventDefault();
              setErr(null);
              start(async () => {
                const r = await askProductQuestionAction({ subdomain, productId, question, name, phone });
                if (!r.ok) return void setErr(r.error);
                setSent(true);
              });
            }}
          >
            <p className="flex items-center gap-2 text-sm font-black">
              <MessageCircleQuestion className="size-4" style={{ color: "var(--primary)" }} aria-hidden="true" /> عندكم سؤال عن المنتج؟
            </p>
            <label className="block">
              <span className="sr-only">السؤال</span>
              <textarea value={question} onChange={(e) => setQuestion(e.target.value)} required rows={3} maxLength={QUESTION_MAX} placeholder="اكتبوا سؤالكم" className="s-input w-full rounded-xl border bg-transparent px-3 py-2 text-base" style={{ borderColor: "var(--border)" }} />
            </label>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="الاسم (اختياري)" aria-label="الاسم (اختياري)" autoComplete="name" className="s-input h-11 w-full rounded-xl border bg-transparent px-3 text-base" style={{ borderColor: "var(--border)" }} />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" dir="ltr" maxLength={20} placeholder="رقم واتساب للرد (اختياري)" aria-label="رقم واتساب للرد (اختياري)" autoComplete="tel" className="s-input h-11 w-full rounded-xl border bg-transparent px-3 text-base" style={{ borderColor: "var(--border)" }} />
            {err ? (
              <p className="text-xs font-bold" style={{ color: "var(--danger, #b91c1c)" }} role="alert">
                {err}
              </p>
            ) : null}
            <button type="submit" disabled={pending} className="s-btn h-11 w-full">
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              <span>إرسال السؤال</span>
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
