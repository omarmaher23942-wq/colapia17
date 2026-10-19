"use client";

// TemplatePicker — قوالب البدء الجاهزة لكل نشاط: ضغطة واحدة تطبّق التصميم الكامل وتركيب الرئيسية المناسب، وتظهر النتيجة في
// المعاينة الحية. لا محتوى مختلق: العناوين محايدة، وما يضيفه التاجر بعدها (منتجات، شعار) يبقى كما هو.
import { useState } from "react";
import { Check } from "lucide-react";
import { THEME_DEFS } from "@/blueprint/themes";
import { saveTemplateAction } from "@/server/actions/setup";
import { TEMPLATE_LIST, templateForNiche, type TemplateId } from "@/lib/store-templates";
import type { Niche } from "@/lib/niche-attributes";
import { cn } from "@/lib/utils";
import { Notice, Spinner } from "./ui";

export function TemplatePicker({ niche, initial, onApplied }: { niche: Niche; initial: string | null; onApplied: () => void }) {
  const suggested = templateForNiche(niche);
  const [value, setValue] = useState<string | null>(initial);
  const [busy, setBusy] = useState<TemplateId | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function choose(id: TemplateId) {
    if (busy) return;
    setErr(null);
    setBusy(id);
    const r = await saveTemplateAction({ template: id }).catch(() => null);
    setBusy(null);
    if (!r || !r.ok) return setErr(r && !r.ok ? r.error : "تعذر تطبيق القالب. تأكدوا من الاتصال وحاولوا مرة أخرى.");
    setValue(id);
    onApplied();
  }

  // المقترح لنشاطكم أولاً.
  const list = [...TEMPLATE_LIST].sort((a, b) => Number(b.id === suggested) - Number(a.id === suggested));
  return (
    <section aria-labelledby="tpl-title" className="space-y-3">
      <div>
        <h2 id="tpl-title" className="text-[15px] font-black text-ink">
          ابدؤوا من قالب جاهز لنشاطكم
        </h2>
        <p className="mt-1 text-[12.5px] leading-6 text-ink-3">يضبط الألوان والخطوط وترتيب الصفحة الرئيسية دفعة واحدة، وتبقى منتجاتكم وبياناتكم كما هي. يمكنكم تغيير أي شيء بعده.</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" role="radiogroup" aria-label="قوالب البدء">
        {list.map((t) => {
          const on = value === t.id;
          const sw = THEME_DEFS[t.theme].swatch;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={busy !== null}
              onClick={() => void choose(t.id)}
              className={cn("relative min-h-24 rounded-2xl border p-3 text-start transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50 disabled:opacity-70", on ? "border-nova bg-nova/[0.08] ring-1 ring-nova/30" : "border-edge/12 hover:border-edge/30")}
            >
              <span className="flex items-center gap-1" aria-hidden="true">
                {sw.map((c) => (
                  <span key={c} className="size-4 rounded-full border border-edge/20" style={{ background: c }} />
                ))}
              </span>
              <span className="mt-2 flex items-center gap-1.5 text-[13.5px] font-black text-ink">
                {t.label}
                {busy === t.id ? <Spinner className="size-3.5" /> : on ? <Check className="size-4 text-nova-2" strokeWidth={3} aria-hidden="true" /> : null}
              </span>
              <span className="mt-0.5 block text-[11.5px] leading-5 text-ink-3">{t.blurb}</span>
              {t.id === suggested && !on ? <span className="absolute end-2 top-2 rounded-md bg-nova/15 px-1.5 py-0.5 text-[10.5px] font-black text-nova-2">مقترح</span> : null}
            </button>
          );
        })}
      </div>
      {err ? <Notice tone="bad">{err}</Notice> : null}
    </section>
  );
}
