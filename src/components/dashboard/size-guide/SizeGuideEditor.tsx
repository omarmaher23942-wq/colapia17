"use client";

// SizeGuideEditor.tsx — جداول المقاسات: إنشاء من قالب أو فارغ، أعمدة حرة، صف لكل مقاس بقياساته ومدى الطول والوزن
// (للمساعد)، ولأي منتجات ينطبق الجدول، ومعاينة المساعد مباشرة. الحفظ يدمج في الـ Blueprint (saveSizeGuideAction).
import { useMemo, useState, useTransition } from "react";
import { Loader2, Plus, Ruler, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { SIZE_TEMPLATES, canRecommend, newChartId, recommendSize, type SizeChart, type SizeGuide, type SizeRow } from "@/lib/size-guide";
import { saveSizeGuideAction } from "@/server/actions/size-guide";
import { ConfirmDialog } from "@/components/dashboard/ui/DashDialog";
import { cn } from "@/lib/utils";

const INPUT = "h-10 w-full rounded-xl border border-edge/10 bg-edge/[0.03] px-3 text-[13px] font-bold text-ink outline-none focus:border-nova disabled:opacity-60";
const num = (v: string): number | null => (v.trim() === "" ? null : Math.max(0, Math.min(300, Math.round(Number(v.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))) || 0))));
const emptyRow = (cols: number): SizeRow => ({ size: "", cells: Array(cols).fill(""), heightFrom: null, heightTo: null, weightFrom: null, weightTo: null });

export function SizeGuideEditor({ initial, categories, canEdit }: { initial: SizeGuide; categories: { id: string; name: string }[]; canEdit: boolean }) {
  const [charts, setCharts] = useState<SizeChart[]>(initial.charts);
  const [saved, setSaved] = useState(JSON.stringify(initial.charts));
  const [pending, start] = useTransition();
  const [removing, setRemoving] = useState<string | null>(null);
  const dirty = JSON.stringify(charts) !== saved;

  const patch = (id: string, fn: (c: SizeChart) => SizeChart) => setCharts((all) => all.map((c) => (c.id === id ? fn(c) : c)));
  const add = (key: string) => {
    const t = SIZE_TEMPLATES.find((x) => x.key === key)!;
    const usedAll = charts.some((c) => c.appliesTo === "all");
    setCharts((all) => [...all, { ...structuredClone(t.chart), id: newChartId(), appliesTo: usedAll ? [] : "all" }]);
  };
  const save = () =>
    start(async () => {
      const r = await saveSizeGuideAction({ charts });
      if (!r.ok) return void toast.error(r.error);
      setSaved(JSON.stringify(charts));
      toast.success("حُفظ دليل المقاسات، ويظهر الآن في صفحات المنتجات");
    });

  return (
    <div className="space-y-5">
      {!canEdit ? <p className="dash-card p-3 text-[12.5px] text-ink-3">عرض فقط: تعديل المقاسات لمن يملك صلاحية إدارة المنتجات.</p> : null}

      {charts.length === 0 ? (
        <div className="dash-card p-6 text-center">
          <Ruler className="mx-auto size-8 text-nova" aria-hidden="true" />
          <p className="mt-3 text-[15px] font-black text-ink">لا جداول مقاسات بعد</p>
          <p className="mt-1 text-[13px] text-ink-3">ابدأ من قالب بقيم شائعة ثم عدّلها لتطابق منتجاتك بالضبط، أو من جدول فارغ.</p>
        </div>
      ) : null}

      {charts.map((c) => (
        <ChartCard key={c.id} chart={c} categories={categories} canEdit={canEdit} onChange={(fn) => patch(c.id, fn)} onRemove={() => setRemoving(c.id)} />
      ))}

      {canEdit && charts.length < 10 ? (
        <div className="dash-card p-4">
          <p className="mb-2 text-[13px] font-black text-ink">جدول جديد</p>
          <div className="flex flex-wrap gap-2">
            {SIZE_TEMPLATES.map((t) => (
              <button key={t.key} type="button" onClick={() => add(t.key)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-edge/10 px-3 text-[12.5px] font-bold text-ink hover:border-nova/50">
                <Plus className="size-4" aria-hidden="true" /> {t.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] text-ink-3">القوالب قيم شائعة في السوق للبداية فقط؛ راجع كل رقم على منتجاتك قبل الحفظ.</p>
        </div>
      ) : null}

      {canEdit ? (
        <div data-savebar className="sticky bottom-3 z-10">
          <button type="button" onClick={save} disabled={!dirty || pending} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-nova to-nova-deep text-sm font-black text-white shadow-xl shadow-nova/30 transition disabled:opacity-50">
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
            {dirty ? "احفظ دليل المقاسات" : "محفوظ"}
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title="حذف الجدول؟"
        description="يختفي من صفحات المنتجات بعد الحفظ."
        confirmLabel="احذف"
        tone="danger"
        onConfirm={async () => {
          setCharts((all) => all.filter((x) => x.id !== removing));
          setRemoving(null);
          return true;
        }}
      />
    </div>
  );
}

function ChartCard({ chart: c, categories, canEdit, onChange, onRemove }: { chart: SizeChart; categories: { id: string; name: string }[]; canEdit: boolean; onChange: (fn: (c: SizeChart) => SizeChart) => void; onRemove: () => void }) {
  const [h, setH] = useState("");
  const [w, setW] = useState("");
  const helper = canRecommend(c);
  const rec = useMemo(() => (helper ? recommendSize(c, { height: num(h), weight: num(w) }) : null), [c, h, w, helper]);
  const setRow = (i: number, p: Partial<SizeRow>) => onChange((x) => ({ ...x, rows: x.rows.map((r, k) => (k === i ? { ...r, ...p } : r)) }));
  const setCol = (i: number, name: string) => onChange((x) => ({ ...x, columns: x.columns.map((col, k) => (k === i ? name : col)) }));
  const addCol = () => onChange((x) => ({ ...x, columns: [...x.columns, `قياس ${x.columns.length + 1}`], rows: x.rows.map((r) => ({ ...r, cells: [...r.cells, ""] })) }));
  const delCol = (i: number) => onChange((x) => ({ ...x, columns: x.columns.filter((_, k) => k !== i), rows: x.rows.map((r) => ({ ...r, cells: r.cells.filter((_, k) => k !== i) })) }));
  const scope = c.appliesTo === "all" ? "all" : "some";

  return (
    <section className="dash-card space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[200px] flex-1 space-y-1 text-[12px] font-bold text-ink-3">
          اسم الجدول (يظهر للعميل)
          <input value={c.name} disabled={!canEdit} maxLength={40} onChange={(e) => onChange((x) => ({ ...x, name: e.target.value }))} className={INPUT} />
        </label>
        <label className="space-y-1 text-[12px] font-bold text-ink-3">
          الوحدة
          <select value={c.unit} disabled={!canEdit} onChange={(e) => onChange((x) => ({ ...x, unit: e.target.value as SizeChart["unit"] }))} className={INPUT}>
            <option value="سم">سم</option>
            <option value="إنش">إنش</option>
          </select>
        </label>
        {canEdit ? (
          <button type="button" onClick={onRemove} className="grid size-10 place-items-center rounded-xl border border-edge/10 text-ink-3 hover:text-rose-400" aria-label={`حذف ${c.name}`}>
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-[12px] font-bold text-ink-3">ينطبق على</legend>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!canEdit} aria-pressed={scope === "all"} onClick={() => onChange((x) => ({ ...x, appliesTo: "all" }))} className={cn("rounded-xl border px-3 py-2 text-[12.5px] font-bold", scope === "all" ? "border-nova/50 bg-nova/10 text-ink" : "border-edge/10 text-ink-3")}>
            كل المنتجات ذات المقاس
          </button>
          <button type="button" disabled={!canEdit || !categories.length} aria-pressed={scope === "some"} onClick={() => onChange((x) => ({ ...x, appliesTo: Array.isArray(x.appliesTo) ? x.appliesTo : [] }))} className={cn("rounded-xl border px-3 py-2 text-[12.5px] font-bold", scope === "some" ? "border-nova/50 bg-nova/10 text-ink" : "border-edge/10 text-ink-3")}>
            أقسام محددة
          </button>
        </div>
        {scope === "some" ? (
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const on = Array.isArray(c.appliesTo) && c.appliesTo.includes(cat.id);
              return (
                <button key={cat.id} type="button" disabled={!canEdit} aria-pressed={on} onClick={() => onChange((x) => ({ ...x, appliesTo: on ? (x.appliesTo as string[]).filter((i) => i !== cat.id) : [...(x.appliesTo as string[]), cat.id] }))} className={cn("rounded-lg border px-2.5 py-1.5 text-[12px] font-bold", on ? "border-nova/50 bg-nova/10 text-ink" : "border-edge/10 text-ink-3")}>
                  {cat.name}
                </button>
              );
            })}
          </div>
        ) : null}
      </fieldset>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[12.5px]">
          <thead>
            <tr className="text-ink-3">
              <th className="p-1.5 text-start font-bold">المقاس</th>
              {c.columns.map((col, i) => (
                <th key={i} className="p-1.5 text-start font-bold">
                  <div className="flex items-center gap-1">
                    <input value={col} disabled={!canEdit} maxLength={20} onChange={(e) => setCol(i, e.target.value)} className={cn(INPUT, "h-9")} aria-label={`اسم العمود ${i + 1}`} />
                    {canEdit && c.columns.length > 1 ? (
                      <button type="button" onClick={() => delCol(i)} className="text-ink-3 hover:text-rose-400" aria-label={`حذف عمود ${col}`}>
                        <X className="size-3.5" aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                </th>
              ))}
              <th className="p-1.5 text-start font-bold">الطول من–إلى (سم)</th>
              <th className="p-1.5 text-start font-bold">الوزن من–إلى (كجم)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {c.rows.map((r, i) => (
              <tr key={i} className="border-t border-edge/10">
                <td className="p-1.5">
                  <input value={r.size} disabled={!canEdit} maxLength={12} onChange={(e) => setRow(i, { size: e.target.value })} className={cn(INPUT, "h-9 w-20")} aria-label="المقاس" />
                </td>
                {c.columns.map((_, k) => (
                  <td key={k} className="p-1.5">
                    <input value={r.cells[k] ?? ""} disabled={!canEdit} maxLength={12} onChange={(e) => setRow(i, { cells: c.columns.map((__, j) => (j === k ? e.target.value : r.cells[j] ?? "")) })} className={cn(INPUT, "h-9")} inputMode="decimal" aria-label={c.columns[k]} />
                  </td>
                ))}
                <td className="p-1.5">
                  <div className="flex gap-1" dir="ltr">
                    <input value={r.heightFrom ?? ""} disabled={!canEdit} onChange={(e) => setRow(i, { heightFrom: num(e.target.value) })} className={cn(INPUT, "h-9 w-16")} inputMode="numeric" aria-label="الطول من" />
                    <input value={r.heightTo ?? ""} disabled={!canEdit} onChange={(e) => setRow(i, { heightTo: num(e.target.value) })} className={cn(INPUT, "h-9 w-16")} inputMode="numeric" aria-label="الطول إلى" />
                  </div>
                </td>
                <td className="p-1.5">
                  <div className="flex gap-1" dir="ltr">
                    <input value={r.weightFrom ?? ""} disabled={!canEdit} onChange={(e) => setRow(i, { weightFrom: num(e.target.value) })} className={cn(INPUT, "h-9 w-16")} inputMode="numeric" aria-label="الوزن من" />
                    <input value={r.weightTo ?? ""} disabled={!canEdit} onChange={(e) => setRow(i, { weightTo: num(e.target.value) })} className={cn(INPUT, "h-9 w-16")} inputMode="numeric" aria-label="الوزن إلى" />
                  </div>
                </td>
                <td className="p-1.5">
                  {canEdit ? (
                    <button type="button" onClick={() => onChange((x) => ({ ...x, rows: x.rows.filter((_, k) => k !== i) }))} className="text-ink-3 hover:text-rose-400" aria-label={`حذف المقاس ${r.size}`}>
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={c.rows.length >= 20} onClick={() => onChange((x) => ({ ...x, rows: [...x.rows, emptyRow(x.columns.length)] }))} className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-edge/10 px-3 text-[12px] font-bold text-ink disabled:opacity-50">
            <Plus className="size-4" aria-hidden="true" /> مقاس
          </button>
          <button type="button" disabled={c.columns.length >= 6} onClick={addCol} className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-edge/10 px-3 text-[12px] font-bold text-ink disabled:opacity-50">
            <Plus className="size-4" aria-hidden="true" /> عمود قياس
          </button>
        </div>
      ) : null}

      <label className="block space-y-1 text-[12px] font-bold text-ink-3">
        ملاحظة تحت الجدول (اختياري)
        <input value={c.note} disabled={!canEdit} maxLength={200} onChange={(e) => onChange((x) => ({ ...x, note: e.target.value }))} placeholder="مثال: القياس والقطعة مفرودة على سطح مستوٍ" className={INPUT} />
      </label>

      <div className="rounded-2xl border border-dashed border-edge/15 p-3">
        <p className="text-[12.5px] font-black text-ink">جرّب المساعد كما يراه عميلك</p>
        {helper ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input value={h} onChange={(e) => setH(e.target.value)} placeholder="الطول سم" inputMode="numeric" className={cn(INPUT, "w-28")} aria-label="طول للتجربة" />
            <input value={w} onChange={(e) => setW(e.target.value)} placeholder="الوزن كجم" inputMode="numeric" className={cn(INPUT, "w-28")} aria-label="وزن للتجربة" />
            <span className="text-[13px] font-bold text-ink">{rec ? `المقترح: ${rec.size}${rec.alternative ? ` (أو ${rec.alternative})` : ""}` : "اكتب طولاً أو وزناً"}</span>
          </div>
        ) : (
          <p className="mt-1 text-[12px] text-ink-3">املأ مدى الطول أو الوزن لكل مقاس ليقترح المتجر المقاس للعميل. بدونهما يظهر الجدول وحده.</p>
        )}
      </div>
    </section>
  );
}
