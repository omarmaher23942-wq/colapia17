"use client";

// StoreLookPage — صفحة «شكل المتجر» الواحدة: الهوية، واجهة المتجر والتعديل بالكلام، شريط الإعلان، أقسام الرئيسية،
// الحركة، وسجل النسخ للاستعادة. معاينة حية للمتجر بجانبها (ورقة على الجوال). كل قسم يحفظ فوراً ويحدّث المعاينة.
import { useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Eye, EyeOff, History, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { saveAnnouncementAction, saveSectionsAction } from "@/server/actions/design";
import { saveMotionAction } from "@/server/actions/motion";
import { undoDesignAction } from "@/server/actions/setup";
import type { DesignHistoryItem } from "@/server/design-tweak";
import { IdentityForm, type IdentityValue } from "@/components/onboarding/IdentityForm";
import { LookPanel } from "@/components/onboarding/LookPanel";
import { DesignChat } from "@/components/design/DesignChat";
import { PreviewFrame, PreviewSheet } from "@/components/onboarding/PreviewPane";
import { btnGhost, btnPrimary, Field, inputCls, Notice, Spinner, Switch } from "@/components/onboarding/ui";
import { Section } from "@/components/dashboard/product/parts";
import { MotionPicker } from "@/components/dashboard/design/MotionPicker";
import { ThemeStudio } from "@/components/dashboard/design/ThemeStudio";
import type { Design, Theme } from "@/blueprint/schema";
import { cn } from "@/lib/utils";

type Sec = { id: string; label: string; enabled: boolean };
type Motion = { level: "calm" | "lively" | "cinematic"; depth: boolean };

export function StoreLookPage({
  storeUrl,
  canEdit,
  identity,
  heroKind,
  announcement,
  sections,
  motion,
  history,
  look,
}: {
  look: { theme: Theme; design: Design };
  storeUrl: string;
  canEdit: boolean;
  identity: IdentityValue;
  heroKind: "video" | "image" | "auto";
  announcement: { text: string; enabled: boolean };
  sections: Sec[];
  motion: Motion;
  history: DesignHistoryItem[];
}) {
  const [version, setVersion] = useState(1);
  const bump = () => setVersion((v) => v + 1);

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-5">
        <header>
          <h1 className="text-[22px] font-black text-ink">شكل المتجر</h1>
          <p className="mt-1 text-[13px] leading-6 text-ink-3">كل تغيير يُحفظ فوراً ويظهر في المعاينة. وإن لم يعجبكم يمكنكم استعادة نسخة سابقة من السجل أدناه.</p>
        </header>
        {!canEdit ? <Notice tone="warn">لديكم صلاحية العرض فقط في هذه الصفحة.</Notice> : null}

        <fieldset disabled={!canEdit} className="space-y-5 border-0 p-0">
          <ThemeStudio initial={look} canEdit={canEdit} onSaved={bump} />

          <Section title="هوية المتجر" hint="الاسم والشعار ولون العلامة. تغيير لون العلامة يغيّر اللون الأساسي ويحفظ خلفية التصميم وأسطحه.">
            <IdentityForm
              initial={identity}
              submitLabel="حفظ الهوية"
              onSaved={() => {
                toast.success("حُفظت هوية المتجر");
                bump();
              }}
            />
          </Section>

          <Section title="التعديل بالوصف" hint="صفوا أي تغيير في الشكل أو المحتوى بجملتكم، وراجعوا الشكل قبل التطبيق وبعده.">
            <DesignChat onChanged={bump} headingLevel={3} />
          </Section>

          <Section title="واجهة المتجر" hint="فيديو أو صورة لواجهة المتجر، أو تلقائياً من صور منتجاتكم.">
            <LookPanel initialHero={heroKind} onChanged={bump} showTweak={false} />
          </Section>

          <AnnouncementSection initial={announcement} onSaved={bump} />
          <SectionsSection initial={sections} onSaved={bump} />
          <MotionSection initial={motion} onSaved={bump} />
        </fieldset>

        <HistorySection items={history} onRestored={bump} canEdit={canEdit} />
      </div>

      <aside aria-label="معاينة المتجر" className="hidden lg:block">
        <div className="sticky top-20 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[12.5px] font-black text-ink">معاينة حية</p>
            <a href={storeUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] font-bold text-nova-2 hover:underline">
              فتح المتجر <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </div>
          <PreviewFrame version={version} />
        </div>
      </aside>
      <PreviewSheet version={version} />
    </div>
  );
}

function AnnouncementSection({ initial, onSaved }: { initial: { text: string; enabled: boolean }; onSaved: () => void }) {
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function save() {
    setBusy(true);
    setErr(null);
    const r = await saveAnnouncementAction(v);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    toast.success("حُفظ شريط الإعلان");
    onSaved();
  }
  return (
    <Section title="شريط الإعلان" hint="شريط رفيع أعلى كل صفحات المتجر لعرض أو خبر أو معلومة شحن.">
      <Switch checked={v.enabled} onChange={(enabled) => setV({ ...v, enabled })} label="إظهار الشريط" />
      <Field label="نص الشريط" count={v.text.length} max={120} error={err}>
        {(p) => <input {...p} value={v.text} onChange={(e) => setV({ ...v, text: e.target.value.slice(0, 120) })} placeholder="مثال: شحن لكل المحافظات" className={inputCls} />}
      </Field>
      <button type="button" className={btnPrimary} disabled={busy} onClick={() => void save()}>
        {busy ? <Spinner /> : null}
        حفظ الشريط
      </button>
    </Section>
  );
}

function SectionsSection({ initial, onSaved }: { initial: Sec[]; onSaved: () => void }) {
  const [items, setItems] = useState(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dirty = JSON.stringify(items) !== saved;
  const move = (i: number, d: -1 | 1) =>
    setItems((cur) => {
      const j = i + d;
      if (j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  async function save() {
    setBusy(true);
    setErr(null);
    const r = await saveSectionsAction({ items: items.map((s) => ({ id: s.id, enabled: s.enabled })) });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    setSaved(JSON.stringify(items));
    toast.success("حُفظ ترتيب الأقسام");
    onSaved();
  }
  return (
    <Section title="أقسام الصفحة الرئيسية" hint="رتّبوا الأقسام بالأسهم، وأخفوا ما لا تحتاجونه. الواجهة وشريط الإعلان يبقيان في أعلى الصفحة.">
      {items.length ? (
        <ul className="divide-y divide-edge/10 rounded-xl border border-edge/10">
          {items.map((s, i) => (
            <li key={s.id} className={cn("flex items-center gap-2 p-2.5", !s.enabled && "opacity-60")}>
              <span className="min-w-0 flex-1 truncate ps-2 text-[13px] font-bold text-ink">{s.label}</span>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`رفع ${s.label}`} className="grid size-9 place-items-center rounded-lg text-ink-3 hover:bg-edge/5 hover:text-ink disabled:opacity-30">
                <ArrowUp className="size-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`خفض ${s.label}`} className="grid size-9 place-items-center rounded-lg text-ink-3 hover:bg-edge/5 hover:text-ink disabled:opacity-30">
                <ArrowDown className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setItems((cur) => cur.map((x) => (x.id === s.id ? { ...x, enabled: !x.enabled } : x)))}
                aria-pressed={s.enabled}
                aria-label={s.enabled ? `إخفاء ${s.label}` : `إظهار ${s.label}`}
                className="grid size-9 place-items-center rounded-lg text-ink-3 hover:bg-edge/5 hover:text-ink"
              >
                {s.enabled ? <Eye className="size-4" aria-hidden="true" /> : <EyeOff className="size-4" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12.5px] text-ink-3">لا توجد أقسام قابلة للترتيب بعد.</p>
      )}
      {err ? <Notice tone="bad">{err}</Notice> : null}
      <button type="button" className={btnPrimary} disabled={busy || !dirty} onClick={() => void save()}>
        {busy ? <Spinner /> : null}
        حفظ الترتيب
      </button>
    </Section>
  );
}

function MotionSection({ initial, onSaved }: { initial: Motion; onSaved: () => void }) {
  const [m, setM] = useState(initial);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const r = await saveMotionAction(m);
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    toast.success(r.orbit === "needs_images" ? "حُفظت الحركة. الواجهة الدوّارة تحتاج 4 صور منتجات على الأقل" : "حُفظت حركة المتجر");
    onSaved();
  }
  return (
    <Section title="حركة المتجر" hint="مستوى الحركة والعمق في الواجهة والبطاقات.">
      <MotionPicker value={m.level} depth={m.depth} onChange={(level) => level !== "auto" && setM({ ...m, level })} onDepth={(depth) => setM({ ...m, depth })} hideAuto />
      <button type="button" className={btnPrimary} disabled={busy || (m.level === initial.level && m.depth === initial.depth)} onClick={() => void save()}>
        {busy ? <Spinner /> : null}
        حفظ الحركة
      </button>
    </Section>
  );
}

function HistorySection({ items, onRestored, canEdit }: { items: DesignHistoryItem[]; onRestored: () => void; canEdit: boolean }) {
  const [busy, setBusy] = useState<number | null>(null);
  async function restore(version: number) {
    setBusy(version);
    const r = await undoDesignAction({ version });
    setBusy(null);
    if (!r.ok) return void toast.error(r.error);
    toast.success("استعدنا النسخة المحددة");
    onRestored();
    // السجل يتحدث بإعادة تحميل الصفحة ليعكس النسخة الجديدة.
    setTimeout(() => window.location.reload(), 700);
  }
  return (
    <Section title="سجل النسخ" hint="تُحفظ نسخة قبل كل تعديل. استعادة نسخة لا تحذف شيئاً، وتُحفظ الحالة الحالية أيضاً.">
      {items.length ? (
        <ul className="divide-y divide-edge/10 rounded-xl border border-edge/10">
          {items.map((h) => (
            <li key={h.version} className="flex items-center gap-3 p-3">
              <History className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-ink">{h.label}</p>
                <p className="text-[11.5px] text-ink-3">{new Date(h.at).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" })}</p>
              </div>
              <button type="button" className={cn(btnGhost, "min-h-10")} disabled={!canEdit || busy !== null} onClick={() => void restore(h.version)}>
                {busy === h.version ? <Spinner /> : <RotateCcw className="size-4" aria-hidden="true" />}
                استعادة
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12.5px] text-ink-3">لا توجد نسخ سابقة بعد. ستظهر هنا بعد أول تعديل.</p>
      )}
    </Section>
  );
}
