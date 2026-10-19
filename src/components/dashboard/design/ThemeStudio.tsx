"use client";

// ThemeStudio — محرر التصميم في «شكل المتجر» (D7): التصميمات الثمانية، وضع العرض، لوحة الألوان (خلفية، سطح، نص،
// أساسي، إبراز) بتباين AA مضمون، الخطوط، أسلوب البطاقة، ونوع الخلفية. معاينة فورية للمسودة، ثم حفظ التغييرات
// الجزئية فقط (diffBlueprint ← saveBlueprintChangesAction) فلا يُكتب فوق ما عدّله غيرها من الصفحات.
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { RotateCcw, ShieldCheck } from "lucide-react";
import { ThemePicker, CardStylePicker, ThemeMini } from "@/components/design/ThemePicker";
import { applyTheme, cardStyleOf, DEFAULT_THEME, isThemeId, setDisplayMode, THEME_DEFS, type CardStyle, type ThemeId } from "@/blueprint/themes";
import { buildPalette, tokensOf, weakestContrast, type CoreTokens } from "@/blueprint/tokens";
import { contrastRatio } from "@/blueprint/palette";
import { diffBlueprint } from "@/lib/blueprint-patch";
import { saveBlueprintChangesAction } from "@/server/actions/blueprint";
import { AVAILABLE_FONTS } from "@/lib/fonts";
import { FONT_VAR } from "@/blueprint/theme";
import type { Design, StoreBackground, StoreBlueprint, Theme } from "@/blueprint/schema";
import { btnGhost, btnPrimary, Notice, Spinner } from "@/components/onboarding/ui";
import { Section } from "@/components/dashboard/product/parts";
import { cn } from "@/lib/utils";

type Look = { theme: Theme; design: Design };

const FONT_NAMES: Record<(typeof AVAILABLE_FONTS)[number], string> = {
  cairo: "القاهرة",
  tajawal: "تجوال",
  ibm_plex_arabic: "IBM Plex",
  almarai: "المراعي",
  changa: "شنغا",
  el_messiri: "المسيري",
  readex_pro: "ريدكس",
  noto_kufi: "نوتو كوفي",
};

const COLOR_FIELDS: Array<{ key: keyof CoreTokens; label: string; hint: string }> = [
  { key: "background", label: "خلفية المتجر", hint: "لون الصفحة كلها" },
  { key: "surface", label: "الأسطح", hint: "البطاقات والنوافذ" },
  { key: "text", label: "النص", hint: "العناوين والفقرات" },
  { key: "primary", label: "اللون الأساسي", hint: "الأزرار والروابط" },
  { key: "accent", label: "لون الإبراز", hint: "الشارات والتوهج" },
];

const BG_KINDS: Array<{ id: StoreBackground["kind"]; label: string }> = [
  { id: "solid", label: "لون مصمت" },
  { id: "gradient", label: "تدرج ناعم" },
  { id: "texture", label: "نسيج خفيف" },
];
const TEXTURES: Array<{ id: StoreBackground["texture"]; label: string }> = [
  { id: "grain", label: "حبيبات" },
  { id: "dots", label: "نقاط" },
  { id: "lines", label: "خطوط مائلة" },
  { id: "grid", label: "شبكة" },
];

const sameLook = (a: Look, b: Look) => JSON.stringify(a) === JSON.stringify(b);

/** يحوّل المسودة إلى Blueprint جزئي (الثيم والتصميم فقط) لتطبيق دوال التصميم الخالصة عليه. */
const asBp = (l: Look) => ({ theme: l.theme, design: l.design }) as unknown as StoreBlueprint;
const fromBp = (bp: StoreBlueprint): Look => ({ theme: bp.theme, design: bp.design });

export function ThemeStudio({ initial, canEdit, onSaved }: { initial: Look; canEdit: boolean; onSaved: () => void }) {
  const [base, setBase] = useState<Look>(initial);
  const [look, setLook] = useState<Look>(initial);
  const [editDark, setEditDark] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const themeId: ThemeId = isThemeId(look.design.theme) ? look.design.theme : DEFAULT_THEME;
  const card = cardStyleOf(asBp(look));
  const auto = look.theme.mode === "auto";
  const editingDark = auto && editDark;
  const palette = editingDark && look.theme.darkPalette ? (look.theme.darkPalette as Theme["palette"]) : look.theme.palette;
  const tokens = tokensOf(palette);
  const bg: StoreBackground = (editingDark ? look.theme.darkBackground : look.theme.background) ?? { kind: "solid", color: palette.background, texture: "grain" };
  const dirty = !sameLook(look, base);
  const weakest = useMemo(() => weakestContrast(buildPalette(tokens)), [tokens]);

  const pickTheme = (id: ThemeId) => setLook((cur) => fromBp(applyTheme(asBp(cur), id)));
  const setMode = (fixed: boolean) => setLook((cur) => fromBp(setDisplayMode(asBp(cur), fixed ? THEME_DEFS[themeId].native : "auto")));

  const setColor = (key: keyof CoreTokens, hex: string) =>
    setLook((cur) => {
      const src = editingDark && cur.theme.darkPalette ? (cur.theme.darkPalette as Theme["palette"]) : cur.theme.palette;
      const next = buildPalette({ ...tokensOf(src), [key]: hex });
      const bgKey = editingDark ? "darkBackground" : "background";
      const curBg = cur.theme[bgKey];
      return {
        ...cur,
        theme: {
          ...cur.theme,
          ...(editingDark ? { darkPalette: next } : { palette: next }),
          [bgKey]: { ...(curBg ?? { kind: "solid", texture: "grain" }), color: next.background },
        },
      };
    });

  const setBg = (patch: Partial<StoreBackground>) =>
    setLook((cur) => {
      const bgKey = editingDark ? "darkBackground" : "background";
      const src = editingDark && cur.theme.darkPalette ? (cur.theme.darkPalette as Theme["palette"]) : cur.theme.palette;
      const curBg = cur.theme[bgKey] ?? { kind: "solid" as const, color: src.background, texture: "grain" as const };
      return { ...cur, theme: { ...cur.theme, [bgKey]: { ...curBg, ...patch, color: src.background } } };
    });

  async function save() {
    setBusy(true);
    setErr(null);
    const changes = diffBlueprint(base as unknown as Record<string, unknown>, look as unknown as Record<string, unknown>);
    const r = await saveBlueprintChangesAction(changes, "تعديل التصميم");
    setBusy(false);
    if (!r.ok) return setErr(r.error ?? "تعذر الحفظ");
    const saved = r.data ? fromBp(r.data.blueprint) : look;
    setBase(saved);
    setLook(saved);
    toast.success("حُفظ التصميم وظهر في المتجر");
    onSaved();
  }

  return (
    <Section title="التصميم" hint="اختاروا تصميماً كاملاً بضغطة، ثم عدّلوا الألوان والخطوط والبطاقة والخلفية كما تريدون. نضبط تباين النصوص تلقائياً ليبقى كل شيء مقروءاً.">
      <fieldset disabled={!canEdit || busy} className="space-y-6 border-0 p-0">
        <div className="space-y-2">
          <h3 className="text-[13px] font-black text-ink">التصميمات</h3>
          <ThemePicker value={look.design.theme && isThemeId(look.design.theme) ? look.design.theme : null} onChange={pickTheme} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,15rem)]">
          <div className="space-y-5">
            <div className="space-y-2">
              <h3 className="text-[13px] font-black text-ink">وضع العرض</h3>
              <div role="radiogroup" aria-label="وضع العرض" className="grid gap-2 sm:grid-cols-2">
                {[
                  { fixed: true, title: "ثابت على هوية التصميم", text: "يظهر المتجر بألوان التصميم نفسها لكل الزوار." },
                  { fixed: false, title: "يتبع جهاز الزائر", text: "فاتح أو داكن تلقائياً بالهوية نفسها." },
                ].map((o) => {
                  const on = o.fixed !== auto;
                  return (
                    <button key={o.title} type="button" role="radio" aria-checked={on} onClick={() => setMode(o.fixed)} className={cn("rounded-xl border p-3 text-start transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-2", on ? "border-nova-2 bg-nova-2/10" : "border-edge/15 hover:border-edge/30")}>
                      <span className="block text-[13px] font-black text-ink">{o.title}</span>
                      <span className="mt-0.5 block text-[12px] leading-5 text-ink-3">{o.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[13px] font-black text-ink">الألوان</h3>
                {auto ? (
                  <div role="tablist" aria-label="نسخة الألوان" className="inline-flex rounded-lg border border-edge/15 p-0.5 text-[12px] font-bold">
                    {[
                      { dark: false, label: "النسخة الفاتحة" },
                      { dark: true, label: "النسخة الداكنة" },
                    ].map((t) => (
                      <button key={t.label} type="button" role="tab" aria-selected={editDark === t.dark} onClick={() => setEditDark(t.dark)} className={cn("min-h-9 rounded-md px-3", editDark === t.dark ? "bg-nova-2/15 text-ink" : "text-ink-3 hover:text-ink")}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="grid gap-2 min-[420px]:grid-cols-2 xl:grid-cols-3">
                {COLOR_FIELDS.map((f) => {
                  const v = tokens[f.key] ?? "#000000";
                  const id = `clr-${f.key}`;
                  return (
                    <label key={f.key} htmlFor={id} className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-edge/15 p-2.5 transition hover:border-edge/30 focus-within:ring-2 focus-within:ring-nova-2">
                      <input id={id} type="color" value={v} onChange={(e) => setColor(f.key, e.target.value)} className="size-10 shrink-0 cursor-pointer rounded-lg border border-edge/20 bg-transparent p-0.5" />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-bold text-ink">{f.label}</span>
                        <span className="block text-[11.5px] text-ink-3">
                          {f.hint} · <span dir="ltr" className="font-mono">{v}</span>
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="flex items-center gap-1.5 text-[12px] text-ink-3">
                <ShieldCheck className="size-4 shrink-0 text-emerald-500" aria-hidden="true" />
                أضعف تباين للنصوص الآن {weakest.toFixed(1)}:1 (الحد المقروء 4.5:1). نعدّل الدرجة تلقائياً إن لزم.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-[13px] font-black text-ink">الخلفية</h3>
              <div role="radiogroup" aria-label="نوع الخلفية" className="flex flex-wrap gap-2">
                {BG_KINDS.map((k) => (
                  <button key={k.id} type="button" role="radio" aria-checked={bg.kind === k.id} onClick={() => setBg({ kind: k.id })} className={cn("min-h-10 rounded-full border px-4 text-[12.5px] font-bold transition", bg.kind === k.id ? "border-nova-2 bg-nova-2/10 text-ink" : "border-edge/15 text-ink-3 hover:text-ink")}>
                    {k.label}
                  </button>
                ))}
              </div>
              {bg.kind === "gradient" ? (
                <label className="flex items-center gap-3 text-[12.5px] font-bold text-ink">
                  <input type="color" value={bg.color2 ?? palette.muted} onChange={(e) => setBg({ color2: e.target.value })} className="size-9 cursor-pointer rounded-lg border border-edge/20 bg-transparent p-0.5" />
                  لون التدرج الثاني
                </label>
              ) : null}
              {bg.kind === "texture" ? (
                <div role="radiogroup" aria-label="النسيج" className="flex flex-wrap gap-2">
                  {TEXTURES.map((t) => (
                    <button key={t.id} type="button" role="radio" aria-checked={bg.texture === t.id} onClick={() => setBg({ texture: t.id })} className={cn("min-h-9 rounded-lg border px-3 text-[12px] font-bold transition", bg.texture === t.id ? "border-nova-2 text-ink" : "border-edge/15 text-ink-3 hover:text-ink")}>
                      {t.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {(["heading", "body"] as const).map((k) => (
                <label key={k} className="block space-y-1.5">
                  <span className="block text-[13px] font-black text-ink">{k === "heading" ? "خط العناوين" : "خط النصوص"}</span>
                  <select
                    value={look.theme.fonts[k]}
                    onChange={(e) => setLook((cur) => ({ ...cur, theme: { ...cur.theme, fonts: { ...cur.theme.fonts, [k]: e.target.value as Theme["fonts"]["heading"] } } }))}
                    className="min-h-11 w-full rounded-xl border border-edge/15 bg-transparent px-3 text-[14px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-2"
                    style={{ fontFamily: FONT_VAR[look.theme.fonts[k]] }}
                  >
                    {AVAILABLE_FONTS.map((f) => (
                      <option key={f} value={f}>
                        {FONT_NAMES[f]}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-[13px] font-black text-ink">معاينة فورية</h3>
            <div className="rounded-2xl border border-edge/15 p-2">
              <ThemeMini id={themeId} card={card} palette={buildPalette(tokens)} />
              <p className="mt-2 px-1 text-[13px] font-black" style={{ fontFamily: FONT_VAR[look.theme.fonts.heading] }}>
                عنوان بخط العناوين
              </p>
              <p className="px-1 text-[12px] text-ink-3" style={{ fontFamily: FONT_VAR[look.theme.fonts.body] }}>
                نص الفقرات والوصف بخط النصوص.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-[13px] font-black text-ink">أسلوب بطاقة المنتج</h3>
          <CardStylePicker value={card} theme={themeId} palette={buildPalette(tokens)} onChange={(c: CardStyle) => setLook((cur) => ({ ...cur, design: { ...cur.design, cardStyle: c } }))} />
        </div>

        {err ? <Notice tone="bad">{err}</Notice> : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnPrimary} disabled={!dirty || busy} onClick={() => void save()}>
            {busy ? <Spinner /> : null}
            حفظ التصميم
          </button>
          <button type="button" className={btnGhost} disabled={!dirty || busy} onClick={() => setLook(base)}>
            <RotateCcw className="size-4" aria-hidden="true" />
            تراجع عن التغييرات
          </button>
        </div>
        {contrastRatio(palette.foreground, palette.background) < 4.5 ? <Notice tone="warn">النص قريب من لون الخلفية؛ سنعدّل درجته عند الحفظ ليبقى مقروءاً.</Notice> : null}
      </fieldset>
    </Section>
  );
}
