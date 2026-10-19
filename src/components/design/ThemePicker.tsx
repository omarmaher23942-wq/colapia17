"use client";

// منتقي التصميمات (عقد مشترك: الإعداد واللوحة). كل خيار معاينة حقيقية مصغّرة بألوان التصميم الفعلية (نفس اللوحة
// التي تُطبَّق على المتجر)، وخلفيته، وخط عناوينه، وبطاقة منتج بأسلوبه (الإطار الزئبقي يتحرك فعلاً).
// CardStylePicker في الملف نفسه لاختيار أسلوب البطاقة وحده.
import { useMemo } from "react";
import { Check } from "lucide-react";
import { THEME_DEFS, THEMES, themePalettes, CARD_STYLE_LABELS, type CardStyle, type ThemeId } from "@/blueprint/themes";
import { cardFxRules } from "@/blueprint/design";
import { FONT_VAR, backgroundLayer } from "@/blueprint/theme";
import type { Palette } from "@/blueprint/schema";
import { cn } from "@/lib/utils";

const CARD_STYLES: CardStyle[] = ["mercury", "cinematic", "glow", "simple"];

/** قواعد البطاقات للمعاينات المصغّرة (مرة واحدة لكل الصفحة). */
function useMiniCss() {
  return useMemo(
    () =>
      CARD_STYLES.map((c) => cardFxRules(c, `.clp-tp[data-card="${c}"]`)).join("") +
      `.clp-tp .s-card{position:relative;overflow:hidden;background:var(--card);color:var(--card-foreground);border:1px solid var(--border);border-radius:var(--r-card);transition:transform .3s,box-shadow .3s,border-color .3s}` +
      `@media (prefers-reduced-motion:reduce){.clp-tp .s-card{animation:none!important;transform:none!important}}`,
    []
  );
}

function vars(p: Palette, radius: number): React.CSSProperties {
  return {
    ["--background" as string]: p.background,
    ["--foreground" as string]: p.foreground,
    ["--card" as string]: p.card,
    ["--card-foreground" as string]: p.cardForeground,
    ["--muted" as string]: p.muted,
    ["--border" as string]: p.border,
    ["--primary" as string]: p.primary,
    ["--primary-foreground" as string]: p.primaryForeground,
    ["--accent" as string]: p.accent,
    ["--r-card" as string]: `${Math.min(radius, 16)}px`,
    ["--elev-hover" as string]: "0 12px 30px -16px rgb(0 0 0 / .35)",
    background: p.background,
    color: p.foreground,
  };
}

/** معاينة مصغّرة: خلفية التصميم + عنوان بخطه + بطاقة منتج بأسلوبها + زر. */
export function ThemeMini({ id, card, palette }: { id: ThemeId; card?: CardStyle; palette?: Palette }) {
  const d = THEME_DEFS[id];
  const p = palette ?? (d.native === "dark" ? themePalettes(id).dark : themePalettes(id).light);
  const bg = d.native === "dark" ? d.darkBg : d.lightBg;
  const layer = backgroundLayer({ kind: bg.kind, color: p.background, color2: bg.color2, texture: bg.texture ?? "grain" });
  const style = vars(p, d.radius.card);
  const layerStyle = Object.fromEntries(
    layer.split(";").filter(Boolean).map((decl) => {
      const i = decl.indexOf(":");
      const k = decl.slice(0, i).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      return [k, decl.slice(i + 1)];
    })
  );
  return (
    <div className="clp-tp relative aspect-[4/3] w-full overflow-hidden rounded-xl" data-card={card ?? d.card} style={{ ...style, ...layerStyle }} aria-hidden="true">
      <div className="flex items-center justify-between px-3 pt-2.5">
        <span className="text-[11px] font-black" style={{ fontFamily: FONT_VAR[d.fonts.heading] }}>
          متجركم
        </span>
        <span className="flex gap-1">
          <span className="block h-1.5 w-5 rounded-full opacity-40" style={{ background: p.foreground }} />
          <span className="block h-1.5 w-3 rounded-full opacity-40" style={{ background: p.foreground }} />
        </span>
      </div>
      <div className="grid grid-cols-[1fr_1.05fr] items-center gap-2.5 px-3 pt-2">
        <div className="min-w-0 space-y-1.5">
          <p className="truncate text-[15px] font-black leading-tight" style={{ fontFamily: FONT_VAR[d.fonts.heading] }}>
            أهلاً بكم
          </p>
          <p className="text-[9px] leading-snug" style={{ color: p.mutedForeground, fontFamily: FONT_VAR[d.fonts.body] }}>
            {d.tagline}
          </p>
          <span className="inline-block px-2.5 py-1 text-[9px] font-black" style={{ background: p.primary, color: p.primaryForeground, borderRadius: Math.min(d.radius.button, 999) }}>
            تسوقوا الآن
          </span>
        </div>
        <div className="s-card p-1" data-in="">
          <span className="block aspect-[4/5] w-full" style={{ borderRadius: Math.max(0, Math.min(d.radius.card, 16) - 4), background: `linear-gradient(150deg, ${p.muted}, color-mix(in srgb, ${p.primary} 28%, ${p.muted}))` }} />
          <span className="mt-1 flex items-center justify-between px-0.5 pb-0.5">
            <span className="block h-1.5 w-8 rounded-full opacity-60" style={{ background: p.cardForeground }} />
            <span className="block h-2 w-5 rounded-full" style={{ background: p.primary }} />
          </span>
        </div>
      </div>
    </div>
  );
}

export function ThemePicker({ value, onChange }: { value: ThemeId | null; onChange: (id: ThemeId) => void }) {
  const css = useMiniCss();
  return (
    <div role="radiogroup" aria-label="التصميم" className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {THEMES.map((t) => {
        const on = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(t.id)}
            className={cn(
              "group relative rounded-2xl border p-2 text-start transition-[box-shadow,border-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#6f86ff]",
              on ? "border-transparent shadow-[0_0_0_2px_#6f86ff]" : "border-black/10 hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10"
            )}
          >
            <ThemeMini id={t.id} />
            <span className="mt-2 flex items-center gap-2 px-1">
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-black">{t.name}</span>
                <span className="block text-[12px] leading-5 opacity-75">{t.tagline}</span>
              </span>
              <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border transition", on ? "border-transparent bg-[#6f86ff] text-[#0b1020]" : "border-current opacity-30")} aria-hidden="true">
                {on ? <Check className="size-3.5" strokeWidth={3} /> : null}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** اختيار أسلوب بطاقة المنتج، بمعاينة على ألوان التصميم الحالي. */
export function CardStylePicker({ value, onChange, theme, palette }: { value: CardStyle; onChange: (c: CardStyle) => void; theme: ThemeId; palette?: Palette }) {
  const css = useMiniCss();
  return (
    <div role="radiogroup" aria-label="أسلوب البطاقة" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {CARD_STYLES.map((c) => {
        const on = value === c;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(c)}
            className={cn(
              "rounded-2xl border p-2 text-start transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#6f86ff]",
              on ? "border-transparent shadow-[0_0_0_2px_#6f86ff]" : "border-black/10 hover:shadow-md dark:border-white/10"
            )}
          >
            <ThemeMini id={theme} card={c} palette={palette} />
            <span className="mt-2 block px-1 text-[13px] font-black">{CARD_STYLE_LABELS[c].name}</span>
            <span className="block px-1 text-[11.5px] leading-5 opacity-75">{CARD_STYLE_LABELS[c].hint}</span>
          </button>
        );
      })}
    </div>
  );
}
