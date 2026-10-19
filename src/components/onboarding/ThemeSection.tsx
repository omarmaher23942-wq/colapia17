"use client";

// ThemeSection — اختيار أحد التصميمات الكاملة في الإعداد: يُطبَّق فوراً (ألوان وخطوط وبطاقات وأزرار) مع إبقاء المحتوى
// والشعار، وتتحدث المعاينة بجانبه. يمكن تغييره لاحقاً من «شكل المتجر» في اللوحة.
import { useState } from "react";
import { ThemePicker } from "@/components/design/ThemePicker";
import { isThemeId, THEMES, type ThemeId } from "@/blueprint/themes";
import { saveThemeAction } from "@/server/actions/setup";
import { Notice, Spinner } from "./ui";

export function ThemeSection({ initial, onChanged }: { initial: string | null; onChanged: () => void }) {
  const [value, setValue] = useState<ThemeId | null>(isThemeId(initial) ? initial : null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  async function choose(id: ThemeId) {
    if (busy) return;
    const prev = value;
    setValue(id);
    setBusy(true);
    setMsg(null);
    const r = await saveThemeAction({ theme: id });
    setBusy(false);
    if (!r.ok) {
      setValue(prev);
      return setMsg({ tone: "bad", text: r.error });
    }
    setMsg({ tone: "ok", text: `طبّقنا تصميم «${THEMES.find((t) => t.id === id)?.name ?? ""}». تحققوا من المعاينة.` });
    onChanged();
  }

  return (
    <section aria-labelledby="theme-title" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="theme-title" className="text-[15px] font-black text-ink">
          تصميم المتجر
        </h2>
        {busy ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-ink-3" role="status">
            <Spinner className="size-3.5" />
            جارٍ التطبيق…
          </span>
        ) : null}
      </div>
      <p className="text-[12.5px] leading-6 text-ink-3">كل تصميم هوية متكاملة: الألوان والخطوط وشكل البطاقات والأزرار. اختاروا الأقرب لعلامتكم، ثم عدّلوا ما تريدون بالأسفل.</p>
      <ThemePicker value={value} onChange={(id) => void choose(id)} />
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
    </section>
  );
}
