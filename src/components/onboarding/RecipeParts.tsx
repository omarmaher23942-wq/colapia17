"use client";

// RecipeParts — لبنات وصفة الإعداد المخصصة: تأكيد بضغطة لما عرفناه، وأسعار المنتجات التي أضافها الفريق، وعدّاد المعاينة.
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { setProductPriceAction } from "@/server/actions/setup";
import type { SetupData } from "@/lib/onboarding";
import { btnGhost, btnPrimary, Notice, Spinner } from "./ui";

/** خطوة جاهزة من إجاباتكم: ملخص قصير وزر تأكيد، و«تعديل» يفتح النموذج الكامل. */
export function PrefilledStep({ lines, onConfirm, onEdit, onBack, confirmLabel = "تأكيد ومتابعة", canBack }: { lines: string[]; onConfirm: () => void; onEdit: () => void; onBack: () => void; confirmLabel?: string; canBack: boolean }) {
  return (
    <div className="space-y-5">
      <Notice tone="ok">
        <p className="font-black">جاهزة من إجاباتكم، ويكفي أن تؤكدوا.</p>
        {lines.length ? (
          <ul className="mt-1.5 space-y-1">
            {lines.map((l) => (
              <li key={l} className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
                {l}
              </li>
            ))}
          </ul>
        ) : null}
      </Notice>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={`${btnPrimary} min-h-12 px-8 text-[15px]`} onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button type="button" className={btnGhost} onClick={onEdit}>
          تعديل
        </button>
        {canBack ? (
          <button type="button" className={btnGhost} onClick={onBack}>
            رجوع
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** منتجات أضافها الفريق وتنتظر السعر: خانة سعر لكل منتج وحفظ فوري. المقاسات والألوان تُضبط من صفحة المنتج في اللوحة. */
export function MissingPrices({ items, onSaved }: { items: SetupData["products"]["missing"]; onSaved: (id: string) => void }) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [gone, setGone] = useState<Set<string>>(new Set());
  const left = items.filter((i) => !gone.has(i.id));
  if (!left.length) return <Notice tone="ok">كل المنتجات لها أسعار.</Notice>;

  async function save(id: string) {
    setBusy(id);
    const r = await setProductPriceAction({ productId: id, price: (vals[id] ?? "").replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))) }).catch(() => ({ ok: false as const, error: "انقطع الاتصال، أعيدوا المحاولة" }));
    setBusy(null);
    if (!r.ok) return setErrs((e) => ({ ...e, [id]: r.error }));
    setErrs((e) => ({ ...e, [id]: "" }));
    setGone((g) => new Set([...g, id]));
    onSaved(id);
  }

  return (
    <ul className="space-y-2.5" aria-label="منتجات تنتظر السعر">
      {left.map((p) => (
        <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-edge/12 p-3">
          {p.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.image} alt="" className="size-14 shrink-0 rounded-xl object-cover" loading="lazy" />
          ) : (
            <span aria-hidden="true" className="size-14 shrink-0 rounded-xl bg-edge/10" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-black text-ink">{p.name}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <label className="sr-only" htmlFor={`price-${p.id}`}>
                سعر {p.name} بالجنيه
              </label>
              <input
                id={`price-${p.id}`}
                inputMode="decimal"
                value={vals[p.id] ?? ""}
                onChange={(e) => setVals((v) => ({ ...v, [p.id]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void save(p.id);
                }}
                placeholder="السعر بالجنيه"
                className="min-h-11 w-32 rounded-xl border border-edge/15 bg-transparent px-3 text-[14px] tabular-nums text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50"
              />
              <button type="button" disabled={busy === p.id || !(vals[p.id] ?? "").trim()} onClick={() => void save(p.id)} className={btnPrimary}>
                {busy === p.id ? <Spinner /> : null}
                حفظ
              </button>
            </div>
            {errs[p.id] ? (
              <p role="alert" className="mt-1 text-[12px] font-bold text-bad">
                {errs[p.id]}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** المتبقي من المعاينة المجانية (hh:mm:ss) في رأس الإعداد. لا يظهر قبل بدء العدّاد. */
export function PreviewClock({ endsAt }: { endsAt: string | null }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!endsAt || now === null) return null;
  const left = Math.max(0, Math.floor((new Date(endsAt).getTime() - now) / 1000));
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    <span className="hidden items-center gap-1 rounded-full bg-nova/12 px-2.5 py-1 text-[11.5px] font-bold text-ink-2 sm:inline-flex" role="timer" aria-label="الوقت المتبقي للمعاينة المجانية">
      <span>المعاينة المجانية</span>
      <bdi dir="ltr" className="tabular-nums">{`${p(Math.floor(left / 3600))}:${p(Math.floor((left % 3600) / 60))}:${p(left % 60)}`}</bdi>
    </span>
  );
}
