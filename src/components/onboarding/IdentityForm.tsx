"use client";

// IdentityForm — اسم المتجر والشعار ولون العلامة وزوج الخطوط. نفس النموذج في خطوة «الهوية» بالإعداد وفي صفحة «شكل المتجر»؛
// الحفظ في الحالتين saveIdentityAction (لوحة الألوان كاملة تُشتق من لون العلامة بتباين AA).
import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { saveIdentityAction, saveLogoAction } from "@/server/actions/setup";
import { BRAND_SWATCHES, brandContrast, FONT_PAIRS, normalizeHex } from "@/lib/onboarding";
import { cn } from "@/lib/utils";
import { btnGhost, btnPrimary, Field, inputCls, Notice, Spinner } from "./ui";
import { uploadImages } from "./upload";

export type IdentityValue = { name: string; primary: string; fontPair: string; logoUrl: string | null };

export function IdentityForm({
  initial,
  onChange,
  onSaved,
  submitLabel = "حفظ ومتابعة",
  secondary,
  onLogoSaved,
}: {
  /** يُستدعى بعد حفظ الشعار فعلاً (لتحديث المعاينة فوراً). */
  onLogoSaved?: () => void;
  initial: IdentityValue;
  /** يُستدعى مع كل تعديل (لتحديث المعاينة المحلية أو علامة التغيير). */
  onChange?: (v: IdentityValue) => void;
  onSaved: (v: IdentityValue) => void;
  submitLabel?: string;
  secondary?: React.ReactNode;
}) {
  const [v, setV] = useState<IdentityValue>({ ...initial, primary: normalizeHex(initial.primary) ?? "#1f3a5f" });
  const [busy, setBusy] = useState(false);
  const [up, setUp] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [nameErr, setNameErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // آخر قيمة دائماً: رفع الشعار غير متزامن، وإن كتب التاجر الاسم أثناءه كان `set` يبني على نسخة قديمة فيمسح ما كتبه.
  const latest = useRef(v);
  const set = (p: Partial<IdentityValue>) => {
    const next = { ...latest.current, ...p };
    latest.current = next;
    setV(next);
    onChange?.(next);
  };
  const isSwatch = BRAND_SWATCHES.some((s) => s.hex === v.primary);
  const light = brandContrast(v.primary) < 3;

  // الشعار يُحفظ فور رفعه (لا ينتظر «حفظ ومتابعة»): يظهر في الهيدر والفوتر وأيقونة التبويب في المعاينة مباشرة.
  // الشعار الشفاف يبقى شفافاً (PNG/WebP)، فلا تظهر حوله خلفية سوداء أو بيضاء.
  async function pickLogo(files: FileList | null) {
    if (!files?.length) return;
    setUp(true);
    setErr(null);
    try {
      const r = await uploadImages([files[0]!], { route: "brandAsset", keepAlpha: true });
      const url = r.urls[0];
      if (!url) return setErr(r.error ?? "تعذر رفع الشعار. حاولوا مرة أخرى.");
      const saved = await saveLogoAction({ url });
      if (!saved.ok) return setErr(saved.error);
      set({ logoUrl: url });
      onLogoSaved?.();
    } finally {
      setUp(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeLogo() {
    setUp(true);
    setErr(null);
    const saved = await saveLogoAction({ url: null });
    setUp(false);
    if (!saved.ok) return setErr(saved.error);
    set({ logoUrl: null });
    onLogoSaved?.();
  }

  async function save() {
    if (busy || up) return;
    setErr(null);
    setNameErr(null);
    if (!v.name.trim()) return setNameErr("اكتبوا اسم المتجر");
    setBusy(true);
    const r = await saveIdentityAction(latest.current);
    setBusy(false);
    if (!r.ok) return r.field === "name" ? setNameErr(r.error) : setErr(r.error);
    onSaved(latest.current);
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Field label="اسم المتجر" error={nameErr} count={v.name.length} max={60}>
        {(p) => <input {...p} value={v.name} onChange={(e) => set({ name: e.target.value.slice(0, 60) })} autoComplete="organization" placeholder="مثال: نور للأزياء" className={inputCls} />}
      </Field>

      <div>
        <p className="mb-1.5 text-[12.5px] font-bold text-ink">الشعار</p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid size-20 place-items-center overflow-hidden rounded-2xl border border-edge/12 bg-edge/[0.04]">
            {v.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.logoUrl} alt="شعار المتجر" className="size-full object-contain p-1.5" />
            ) : (
              <span className="px-1 text-center text-[13px] font-black leading-tight text-ink-2" aria-hidden="true">
                {v.name.trim().slice(0, 12) || "اسمكم"}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" aria-label="ملف الشعار" className="sr-only" tabIndex={-1} onChange={(e) => void pickLogo(e.target.files)} />
            <button type="button" className={btnGhost} disabled={up} onClick={() => fileRef.current?.click()}>
              {up ? <Spinner /> : <ImagePlus className="size-4" aria-hidden="true" />}
              {v.logoUrl ? "تغيير الشعار" : "رفع الشعار"}
            </button>
            {v.logoUrl ? (
              <button type="button" className={btnGhost} disabled={up} onClick={() => void removeLogo()}>
                <Trash2 className="size-4" aria-hidden="true" />
                بدون شعار الآن
              </button>
            ) : null}
          </div>
        </div>
        <p className="mt-1.5 text-[11.5px] leading-5 text-ink-3">{v.logoUrl ? "حُفظ الشعار، ويظهر الآن في أعلى المتجر وأسفله وفي الفواتير وأيقونة التبويب. الأفضل شعار بخلفية شفافة (PNG)." : "بلا شعار نعرض اسم المتجر نصاً أنيقاً في الأعلى، ويمكنكم إضافة الشعار في أي وقت."}</p>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-[12.5px] font-bold text-ink">لون العلامة</legend>
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="لون العلامة">
          {BRAND_SWATCHES.map((s) => {
            const on = v.primary === s.hex;
            return (
              <button
                key={s.hex}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={s.name}
                title={s.name}
                onClick={() => set({ primary: s.hex })}
                className={cn("grid size-11 place-items-center rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50 focus-visible:ring-offset-2 focus-visible:ring-offset-space", on ? "scale-105 border-ink" : "border-transparent")}
                style={{ background: s.hex }}
              >
                {on ? <span className="size-2 rounded-full bg-white" /> : null}
              </button>
            );
          })}
          <label className={cn("relative grid size-11 cursor-pointer place-items-center rounded-full border-2 text-[10px] font-black text-ink-2 transition focus-within:ring-2 focus-within:ring-nova/50", !isSwatch ? "border-ink" : "border-dashed border-edge/30")} style={!isSwatch ? { background: v.primary } : undefined}>
            <span className={cn(!isSwatch && "text-white mix-blend-difference")}>{isSwatch ? "مخصص" : ""}</span>
            <input type="color" value={v.primary} onChange={(e) => set({ primary: e.target.value })} aria-label="اختيار لون مخصص" className="absolute inset-0 size-full cursor-pointer opacity-0" />
          </label>
        </div>
        {light ? <p className="mt-2 text-[12px] leading-5 text-ink-3">هذا اللون فاتح؛ نضبط ألوان النصوص تلقائياً ليبقى كل شيء مقروءاً بوضوح.</p> : null}
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 text-[12.5px] font-bold text-ink">الخطوط</legend>
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="زوج الخطوط">
          {FONT_PAIRS.map((f) => {
            const on = v.fontPair === f.id;
            return (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => set({ fontPair: f.id })}
                className={cn("rounded-2xl border p-3 text-start transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50", on ? "border-nova bg-nova/[0.07] ring-1 ring-nova/30" : "border-edge/12 hover:border-edge/30")}
              >
                <span className="block text-[20px] font-black leading-tight text-ink" style={{ fontFamily: `var(--font-${f.heading.replace(/_/g, "-")}), var(--font-cairo), sans-serif` }}>
                  متجر أنيق
                </span>
                <span className="mt-1 block text-[12px] text-ink-3" style={{ fontFamily: `var(--font-${f.body.replace(/_/g, "-")}), var(--font-cairo), sans-serif` }}>
                  {f.name}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {err ? <Notice tone="bad">{err}</Notice> : null}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? <Spinner /> : null}
          {submitLabel}
        </button>
        {secondary}
      </div>
    </form>
  );
}
