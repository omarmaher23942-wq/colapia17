"use client";

// BulkEditor — تعديل جماعي كجدول: السعر والسعر قبل الخصم والمخزون (وتركيباته) والحالة لكل منتج في صف، والحفظ دفعة واحدة.
// Enter ينتقل لنفس الخانة في الصف التالي كجدول البيانات. الأخطاء تُعلَّم على الخانة نفسها، ولا يُحفظ شيء حتى تصح كل الصفوف.
import { useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Save, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { arCount, fmtNum, NOUN } from "@/lib/format";
import { BULK_STATUSES, planBulkEdit, type BulkIssue, type BulkRow } from "@/lib/bulk-edit";
import { saveBulkProductsAction, type BulkSaveResult } from "@/server/actions/bulk-products";
import type { BulkProductRow } from "@/server/repos/bulk-products";

const STATUS_LABEL: Record<(typeof BULK_STATUSES)[number], string> = { active: "منشور", draft: "مسودة", hidden: "مخفي", archived: "مؤرشف" };
const cell = "min-h-11 w-full rounded-lg border bg-transparent px-2.5 text-[13px] tabular-nums text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova disabled:opacity-50";

export function BulkEditor({ initial }: { initial: BulkProductRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<BulkProductRow[]>(initial);
  const [issues, setIssues] = useState<BulkIssue[]>([]);
  const [filter, setFilter] = useState("");
  const [pending, start] = useTransition();
  const base = useRef(initial);
  const { patches } = useMemo(() => planBulkEdit(base.current as BulkRow[], rows as BulkRow[]), [rows]);
  const changed = useMemo(() => {
    const m = new Set<string>();
    for (const r of rows) {
      const o = base.current.find((x) => x.id === r.id);
      if (o && JSON.stringify([o.price, o.compareAt, o.stock, o.status, o.variants.map((v) => [v.stock, v.price])]) !== JSON.stringify([r.price, r.compareAt, r.stock, r.status, r.variants.map((v) => [v.stock, v.price])])) m.add(r.id);
    }
    return m;
  }, [rows]);
  const bad = (id: string, field: BulkIssue["field"]) => issues.find((i) => i.id === id && i.field === field);
  const patch = (id: string, f: (r: BulkProductRow) => BulkProductRow) => setRows((p) => p.map((r) => (r.id === id ? f(r) : r)));
  const shown = rows.filter((r) => !filter.trim() || r.name.toLowerCase().includes(filter.trim().toLowerCase()));

  const onEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const col = e.currentTarget.dataset.col;
    const all = [...document.querySelectorAll<HTMLInputElement>(`input[data-col="${col}"]:not(:disabled)`)];
    all[all.indexOf(e.currentTarget) + 1]?.focus();
  };

  const save = () =>
    start(async () => {
      const r = await saveBulkProductsAction(rows.filter((x) => changed.has(x.id)).map(({ id, name, price, compareAt, stock, status, variants }) => ({ id, name, price, compareAt, stock, status, variants }))).catch((): BulkSaveResult => ({ ok: false, error: "انقطع الاتصال" }));
      if (!r.ok) {
        setIssues(r.issues ?? []);
        return void toast.error(r.error);
      }
      setIssues([]);
      toast.success(r.saved ? `حُفظ ${arCount(r.saved, NOUN.product)}` : "لا تغييرات للحفظ");
      base.current = rows;
      router.refresh();
    });

  if (!rows.length) return <p className="dash-card px-5 py-10 text-center text-[13px] text-ink-2">لا منتجات بعد. أضيفوا منتجاً أو استوردوا منتجاتكم أولاً.</p>;

  return (
    <div className="space-y-3 pb-24">
      <input
        aria-label="بحث بالاسم"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="ابحثوا عن منتج بالاسم"
        className="min-h-11 w-full rounded-xl border border-edge/10 bg-transparent px-3 text-[13px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova sm:max-w-sm"
      />
      <p className="text-[12px] leading-5 text-ink-3">السعر بالجنيه. المخزون الفارغ يعني «بلا حد». مخزون المنتج ذي التركيبات مجموع تركيباته فعدّلوها من الأسفل. Enter ينقلكم للصف التالي.</p>

      <div className="hidden grid-cols-[minmax(0,2.2fr)_1fr_1fr_1fr_1fr] gap-2 px-3 text-[11.5px] font-bold text-ink-3 md:grid">
        <span>المنتج</span>
        <span>السعر</span>
        <span>قبل الخصم</span>
        <span>المخزون</span>
        <span>الحالة</span>
      </div>
      <ul className="space-y-2">
        {shown.map((r) => {
          const hasVariants = r.variants.length > 0;
          return (
            <li key={r.id} className={cn("dash-card p-3", changed.has(r.id) && "ring-2 ring-nova/50")}>
              <div className="grid items-start gap-2 md:grid-cols-[minmax(0,2.2fr)_1fr_1fr_1fr_1fr]">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="relative block size-11 shrink-0 overflow-hidden rounded-lg bg-edge/[0.06]">{r.image ? <Image src={r.image} alt="" fill sizes="44px" className="object-cover" /> : null}</span>
                  <Link href={`/dashboard/products/${r.id}`} className="min-w-0 truncate text-[13.5px] font-black text-ink hover:underline">
                    {r.name}
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-2 md:contents">
                  <Field label="السعر" err={bad(r.id, "price")?.message}>
                    <input data-col="price" inputMode="decimal" aria-label={`سعر ${r.name}`} value={r.price} onChange={(e) => patch(r.id, (x) => ({ ...x, price: e.target.value }))} onKeyDown={onEnter} className={cn(cell, bad(r.id, "price") ? "border-bad" : "border-edge/10")} />
                  </Field>
                  <Field label="قبل الخصم" err={bad(r.id, "compareAt")?.message}>
                    <input data-col="compare" inputMode="decimal" aria-label={`السعر قبل الخصم لـ ${r.name}`} value={r.compareAt} onChange={(e) => patch(r.id, (x) => ({ ...x, compareAt: e.target.value }))} onKeyDown={onEnter} className={cn(cell, bad(r.id, "compareAt") ? "border-bad" : "border-edge/10")} />
                  </Field>
                  <Field label="المخزون" err={bad(r.id, "stock")?.message}>
                    <input
                      data-col="stock"
                      inputMode="numeric"
                      aria-label={`مخزون ${r.name}`}
                      disabled={hasVariants || !r.trackStock}
                      placeholder={hasVariants ? "من التركيبات" : r.trackStock ? "بلا حد" : "غير متتبَّع"}
                      value={hasVariants ? "" : r.stock}
                      onChange={(e) => patch(r.id, (x) => ({ ...x, stock: e.target.value }))}
                      onKeyDown={onEnter}
                      className={cn(cell, bad(r.id, "stock") ? "border-bad" : "border-edge/10")}
                    />
                  </Field>
                  <Field label="الحالة">
                    <select aria-label={`حالة ${r.name}`} value={r.status} onChange={(e) => patch(r.id, (x) => ({ ...x, status: e.target.value as BulkRow["status"] }))} className={cn(cell, "border-edge/10")}>
                      {BULK_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>
              {hasVariants ? (
                <details className="mt-2 rounded-lg bg-edge/[0.03] p-2" open={bad(r.id, "variant") !== undefined}>
                  <summary className="min-h-9 cursor-pointer text-[12px] font-bold text-ink-2">تركيبات المقاس واللون ({fmtNum(r.variants.length)})</summary>
                  {bad(r.id, "variant") ? <p className="text-[12px] text-bad">{bad(r.id, "variant")!.message}</p> : null}
                  <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                    {r.variants.map((v) => (
                      <li key={v.id} className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] items-center gap-2">
                        <span className="truncate text-[12.5px] font-bold text-ink">{v.label}</span>
                        <input data-col={`vs-${v.id}`} inputMode="numeric" aria-label={`مخزون ${v.label}`} placeholder="بلا حد" value={v.stock} onChange={(e) => patch(r.id, (x) => ({ ...x, variants: x.variants.map((y) => (y.id === v.id ? { ...y, stock: e.target.value } : y)) }))} className={cn(cell, "border-edge/10")} />
                        <input data-col={`vp-${v.id}`} inputMode="decimal" aria-label={`سعر ${v.label}`} placeholder="سعر المنتج" value={v.price} onChange={(e) => patch(r.id, (x) => ({ ...x, variants: x.variants.map((y) => (y.id === v.id ? { ...y, price: e.target.value } : y)) }))} className={cn(cell, "border-edge/10")} />
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div data-savebar className="fixed inset-x-0 bottom-0 z-30 border-t border-edge/10 bg-space-2/95 p-3 backdrop-blur-xl md:start-[264px]" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <p className="text-[12.5px] font-bold text-ink-2">{changed.size ? `${arCount(changed.size, NOUN.product)} معدَّل${patches.length < changed.size ? " (فيه خانات تحتاج تصحيحاً)" : ""}` : "لا تغييرات"}</p>
          <div className="flex gap-2">
            <button type="button" disabled={!changed.size || pending} onClick={() => { setRows(base.current); setIssues([]); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-edge/10 px-4 text-[13px] font-bold text-ink-2 hover:bg-edge/[0.06] disabled:opacity-50">
              <Undo2 className="size-4" aria-hidden="true" />
              تراجع
            </button>
            <button type="button" disabled={!changed.size || pending} onClick={save} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-5 text-[13px] font-black text-white shadow-md disabled:opacity-50">
              <Save className="size-4" aria-hidden="true" />
              {pending ? "جارٍ الحفظ" : "حفظ التغييرات"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, err, children }: { label: string; err?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <span className="mb-0.5 block text-[10.5px] font-bold text-ink-3 md:hidden">{label}</span>
      {children}
      {err ? <span className="mt-0.5 block text-[11px] leading-4 text-bad">{err}</span> : null}
    </div>
  );
}
