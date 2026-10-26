"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, CircleDashed, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Field, Section, inputCls } from "@/components/dashboard/product/parts";
import type { Check } from "@/server/setup/status";
import { removeGroqKeyAction, saveGroqKeyAction, testImageKitAction } from "./actions";

const LEVEL = {
  ok: { icon: CheckCircle2, cls: "text-ok", label: "جاهز" },
  missing: { icon: AlertTriangle, cls: "text-warn", label: "مطلوب" },
  optional: { icon: CircleDashed, cls: "text-ink-3", label: "اختياري" },
} as const;

export function IntegrationsCenter({ checks, groqSaved, groqFromEnv }: { checks: Check[]; groqSaved: string | null; groqFromEnv: boolean }) {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState<"save" | "remove" | "images" | null>(null);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[22px] font-black text-ink">الربط والمفاتيح</h1>
        <p className="mt-1 text-[13px] leading-6 text-ink-3">حالة الخدمات المربوطة بمشروعكم. تُضبط المفاتيح في Cloudflare (Settings ← Variables and Secrets)، ما عدا مفتاح Groq فيمكن إدخاله هنا.</p>
      </header>

      <Section title="الحالة" hint="تتحدث عند فتح الصفحة">
        <ul className="space-y-3">
          {checks.map((c) => {
            const ui = LEVEL[c.level];
            return (
              <li key={c.id} className="rounded-xl border border-edge/10 p-3.5">
                <div className="flex items-start gap-3">
                  <ui.icon className={cn("mt-0.5 size-5 shrink-0", ui.cls)} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-black text-ink">
                      {c.label} <span className={cn("ms-1 text-[11.5px] font-bold", ui.cls)}>{ui.label}</span>
                    </p>
                    <p className="mt-0.5 text-[12.5px] leading-6 text-ink-2">{c.detail}</p>
                    {c.level !== "ok" && c.fix ? <p className="mt-1 text-[12px] leading-6 text-ink-3">{c.fix}</p> : null}
                    {c.id === "images" && c.level === "ok" ? (
                      <button
                        type="button"
                        disabled={busy === "images"}
                        onClick={async () => {
                          setBusy("images");
                          const r = await testImageKitAction().catch(() => ({ ok: false as const, error: "انقطع الاتصال" }));
                          setBusy(null);
                          if (r.ok) toast.success("ImageKit يعمل");
                          else toast.error(r.error);
                        }}
                        className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-edge/10 px-3 text-[12px] font-bold text-ink-2 hover:bg-edge/[0.05]"
                      >
                        {busy === "images" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                        اختبار الاتصال
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="مفتاح Groq" hint="للميزات الذكية: قراءة صور المنتجات، الأوصاف، مساعد التصميم، البحث بالصورة">
        {groqFromEnv ? (
          <p className="text-[12.5px] leading-6 text-ink-2">المفتاح مضبوط من متغيرات Cloudflare (GROQ_API_KEY) وله الأولوية. لتغييره عدّلوا المتغير هناك.</p>
        ) : (
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy("save");
              const r = await saveGroqKeyAction(key).catch(() => ({ ok: false as const, error: "انقطع الاتصال" }));
              setBusy(null);
              if (!r.ok) return void toast.error(r.error);
              setKey("");
              toast.success("حُفظ المفتاح بعد اختباره");
              router.refresh();
            }}
          >
            {groqSaved ? <p className="text-[12.5px] text-ink-2">المحفوظ حالياً: <bdi dir="ltr" className="font-mono">{groqSaved}</bdi></p> : null}
            <Field label={groqSaved ? "استبدال المفتاح" : "المفتاح"} hint="من console.groq.com/keys (يبدأ بـ gsk_)">
              {(a) => <input {...a} value={key} onChange={(e) => setKey(e.target.value)} dir="ltr" autoComplete="off" spellCheck={false} placeholder="gsk_…" className={cn(inputCls, "font-mono")} />}
            </Field>
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={!key.trim() || busy !== null} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-4 text-[12.5px] font-black text-white shadow-md disabled:opacity-60">
                {busy === "save" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                اختبار وحفظ
              </button>
              {groqSaved ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={async () => {
                    setBusy("remove");
                    const r = await removeGroqKeyAction().catch(() => ({ ok: false as const, error: "انقطع الاتصال" }));
                    setBusy(null);
                    if (!r.ok) return void toast.error(r.error);
                    toast.success("حُذف المفتاح");
                    router.refresh();
                  }}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-bad/20 px-4 text-[12.5px] font-bold text-bad hover:bg-bad/10"
                >
                  حذف المفتاح
                </button>
              ) : null}
            </div>
          </form>
        )}
      </Section>
    </div>
  );
}
