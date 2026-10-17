"use client";

// ContentStudio — استوديو المحتوى: اختيار نوع المحتوى والمنتجات ثم نصوص جاهزة للنسخ، وتحسين وصف المنتج بتأكيد قبل الكتابة.
// النصوص تُبنى من بيانات المتجر الحقيقية، وكل عملية تُحسب على حد الاستخدام الشهري.
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, Rocket, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { arCount, fmtNum, NOUN } from "@/lib/format";
import { KIND_INFO, STUDIO_KINDS, type StudioKind } from "@/lib/studio";
import { applyDescriptionAction, generateContentAction, suggestDescriptionAction, type DescriptionSuggestion } from "@/server/actions/studio";

export type StudioProductOption = { id: string; name: string; hasDescription: boolean };
type Tab = StudioKind | "description";

const chip = (on: boolean) => cn("inline-flex min-h-10 shrink-0 items-center rounded-xl border px-3 text-[12.5px] font-bold transition-colors", on ? "border-nova bg-nova text-white" : "border-edge/10 text-ink-2 hover:bg-edge/[0.05]");

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("نُسخ النص");
  } catch {
    toast.error("تعذّر النسخ، حدّدوا النص وانسخوه يدوياً");
  }
}

function CopyBtn({ text }: { text: string }) {
  return (
    <button type="button" onClick={() => copy(text)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-edge/10 px-3 text-[12px] font-bold text-ink-2 hover:bg-edge/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova">
      <Copy className="size-4" aria-hidden="true" />
      نسخ
    </button>
  );
}

type Item = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" ? v : "");
const tags = (v: unknown) => (Array.isArray(v) ? (v as string[]).map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ") : "");

function Result({ kind, item }: { kind: StudioKind; item: Item }) {
  let body: React.ReactNode;
  let copyText: string;
  if (kind === "captions" || kind === "product_post") {
    copyText = `${s(item.text)}\n\n${tags(item.hashtags)}`.trim();
    body = (
      <>
        <p className="whitespace-pre-line text-[13.5px] leading-7 text-ink">{s(item.text)}</p>
        {tags(item.hashtags) ? <p className="mt-1 text-[12px] text-nova-2" dir="auto">{tags(item.hashtags)}</p> : null}
      </>
    );
  } else if (kind === "stories") {
    const slides = (item.slides as string[]) ?? [];
    copyText = slides.join("\n");
    body = (
      <>
        <p className="text-[12.5px] font-black text-ink-2">{s(item.title)}</p>
        <ol className="mt-1 space-y-1">
          {slides.map((x, i) => (
            <li key={i} className="rounded-lg bg-edge/[0.05] px-3 py-2 text-[13px] leading-6 text-ink">
              <span className="me-2 text-ink-3 tabular-nums">{fmtNum(i + 1)}</span>
              {x}
            </li>
          ))}
        </ol>
      </>
    );
  } else if (kind === "ad_copy") {
    copyText = `${s(item.headline)}\n${s(item.primary)}\n${s(item.cta)}`;
    body = (
      <>
        <p className="text-[14px] font-black text-ink">{s(item.headline)}</p>
        <p className="mt-1 text-[13px] leading-6 text-ink-2">{s(item.primary)}</p>
        <p className="mt-1 inline-block rounded-md bg-nova/12 px-2 py-0.5 text-[12px] font-bold text-nova-2">{s(item.cta)}</p>
      </>
    );
  } else {
    copyText = s(item.caption);
    body = (
      <>
        <p className="text-[12.5px] font-black text-ink">
          {s(item.day)} · <span className="text-nova-2">{({ post: "منشور", story: "ستوري", reel: "ريلز" } as Record<string, string>)[s(item.format)] ?? s(item.format)}</span>
        </p>
        <p className="mt-0.5 text-[12.5px] text-ink-2">{s(item.idea)}</p>
        <p className="mt-1 whitespace-pre-line text-[13px] leading-6 text-ink">{s(item.caption)}</p>
      </>
    );
  }
  return (
    <li className="dash-card flex items-start justify-between gap-3 p-4">
      <div className="min-w-0 flex-1">{body}</div>
      <CopyBtn text={copyText} />
    </li>
  );
}

export function ContentStudio({ productsList }: { productsList: StudioProductOption[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("captions");
  const [picked, setPicked] = useState<string[]>([]);
  const [result, setResult] = useState<{ kind: StudioKind; items: Item[]; dropped: number } | null>(null);
  const [pending, start] = useTransition();
  const [sugg, setSugg] = useState<Extract<DescriptionSuggestion, { ok: true }> | null>(null);

  const isKind = tab !== "description";
  const single = tab === "product_post" || tab === "description";
  const toggle = (id: string) => setPicked((p) => (single ? [id] : p.includes(id) ? p.filter((x) => x !== id) : p.length >= 6 ? p : [...p, id]));
  const switchTab = (t: Tab) => {
    setTab(t);
    setResult(null);
    setSugg(null);
    setPicked((p) => (t === "product_post" || t === "description" ? p.slice(0, 1) : p));
  };

  const generate = () =>
    start(async () => {
      if (!isKind) return;
      const r = await generateContentAction({ kind: tab, productIds: picked }).catch(() => ({ ok: false as const, error: "انقطع الاتصال" }));
      if (!r.ok) return void toast.error(r.error);
      setResult({ kind: r.kind, items: r.items as Item[], dropped: r.dropped });
    });

  const suggest = () =>
    start(async () => {
      const r = await suggestDescriptionAction(picked[0] ?? "").catch(() => ({ ok: false as const, error: "انقطع الاتصال" }));
      if (!r.ok) return void toast.error(r.error);
      setSugg(r);
    });

  const apply = () =>
    start(async () => {
      if (!sugg) return;
      const r = await applyDescriptionAction(sugg.productId, sugg.description, sugg.shortDescription).catch(() => ({ ok: false as const, error: "انقطع الاتصال" }));
      if (!r.ok) return void toast.error(r.error);
      toast.success("حُدّث وصف المنتج");
      setSugg(null);
      router.refresh();
    });

  const needs = isKind ? KIND_INFO[tab].needsProducts : true;
  const ready = !needs || picked.length > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-edge/10 pb-4">
        <div>
          <h1 className="text-2xl font-black text-ink">استوديو المحتوى</h1>
          <p className="mt-1 max-w-xl text-[13px] leading-6 text-ink-2">نصوص جاهزة لنشر منتجاتكم تُبنى من بيانات متجركم الفعلية، دون أسعار أو عروض أو وعود غير موجودة عندكم. راجعوا النص وعدّلوه قبل النشر.</p>
        </div>
        <Link href="/dashboard/marketing" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-edge/10 px-4 text-[13px] font-bold text-ink hover:bg-edge/[0.06]">
          <Rocket className="size-4" aria-hidden="true" />
          عُدّة الإطلاق
        </Link>
      </header>

      <nav aria-label="نوع المحتوى" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {STUDIO_KINDS.map((k) => (
          <button key={k} type="button" aria-pressed={tab === k} onClick={() => switchTab(k)} className={chip(tab === k)}>
            {KIND_INFO[k].label}
          </button>
        ))}
        <button type="button" aria-pressed={tab === "description"} onClick={() => switchTab("description")} className={chip(tab === "description")}>
          تحسين وصف منتج
        </button>
      </nav>
      <p className="text-[12.5px] text-ink-3">{isKind ? KIND_INFO[tab].hint : "اقترحوا وصفاً أوضح لمنتج موجود. لا يُكتب شيء في المنتج قبل موافقتكم."}</p>

      {needs ? (
        <section aria-label="اختيار المنتجات" className="dash-card p-3">
          <p className="mb-2 text-[12px] font-bold text-ink-2">
            {single ? "اختاروا منتجاً" : `اختاروا حتى 6 منتجات (${arCount(picked.length, NOUN.product)})`}
          </p>
          {productsList.length ? (
            <ul className="grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2">
              {productsList.map((p) => (
                <li key={p.id}>
                  <label className={cn("flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[13px]", picked.includes(p.id) ? "bg-nova/12 font-bold text-ink" : "text-ink-2 hover:bg-edge/[0.05]")}>
                    <input type={single ? "radio" : "checkbox"} name="studio-product" checked={picked.includes(p.id)} onChange={() => toggle(p.id)} className="size-4 accent-[var(--dash-nova,#6f86ff)]" />
                    <span className="min-w-0 truncate">{p.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-center text-[12.5px] text-ink-3">لا منتجات منشورة بعد. أضيفوا منتجاتكم أولاً.</p>
          )}
        </section>
      ) : null}

      <button
        type="button"
        disabled={pending || !ready || (!isKind && picked.length !== 1)}
        onClick={isKind ? generate : suggest}
        className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-6 text-[14px] font-black text-white shadow-md disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-2"
      >
        <Sparkles className="size-4" aria-hidden="true" />
        {pending ? "جارٍ الإعداد…" : isKind ? "إنشاء المحتوى" : "اقتراح وصف"}
      </button>

      {isKind && result && result.kind === tab ? (
        <section aria-label="النتائج" aria-live="polite" className="space-y-2">
          <ul className="space-y-2">{result.items.map((it, i) => <Result key={i} kind={result.kind} item={it} />)}</ul>
          {result.dropped ? <p className="text-[11.5px] text-ink-3">استُبعد {arCount(result.dropped, NOUN.item)} لاحتوائه معلومات غير موجودة في بياناتكم.</p> : null}
        </section>
      ) : null}

      {!isKind && sugg ? (
        <section aria-label="مقارنة الوصف" aria-live="polite" className="grid gap-3 md:grid-cols-2">
          <div className="dash-card p-4">
            <h2 className="text-[12.5px] font-black text-ink-3">الوصف الحالي</h2>
            <p className="mt-2 whitespace-pre-line text-[13px] leading-6 text-ink-2">{sugg.current || "لا يوجد وصف حالياً."}</p>
          </div>
          <div className="dash-card border-nova/40 p-4">
            <h2 className="text-[12.5px] font-black text-nova-2">المقترح</h2>
            <p className="mt-2 text-[12px] font-bold text-ink-2">{sugg.shortDescription}</p>
            <p className="mt-1 whitespace-pre-line text-[13px] leading-6 text-ink">{sugg.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={pending} onClick={apply} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-4 text-[13px] font-black text-white disabled:opacity-50">
                <Check className="size-4" aria-hidden="true" />
                اعتماد الوصف
              </button>
              <button type="button" onClick={() => setSugg(null)} className="min-h-11 rounded-xl border border-edge/10 px-4 text-[13px] font-bold text-ink-2 hover:bg-edge/[0.06]">
                تجاهل
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
