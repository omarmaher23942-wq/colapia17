"use client";
// منتقي التصميمات (عقد مشترك: الإعداد واللوحة). يُكمله W-A بمعاينات حقيقية.
import { THEMES, type ThemeId } from "@/blueprint/themes";

export function ThemePicker({ value, onChange }: { value: ThemeId | null; onChange: (id: ThemeId) => void }) {
  return (
    <div role="radiogroup" aria-label="التصميم" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {THEMES.map((t) => (
        <button key={t.id} type="button" role="radio" aria-checked={value === t.id} onClick={() => onChange(t.id)}
          className="rounded-xl border p-3 text-start aria-checked:ring-2">
          <span className="flex gap-1">{t.swatch.map((c) => <span key={c} className="h-5 w-5 rounded-full" style={{ background: c }} />)}</span>
          <span className="mt-2 block font-bold">{t.name}</span>
          <span className="block text-xs opacity-70">{t.tagline}</span>
        </button>
      ))}
    </div>
  );
}
