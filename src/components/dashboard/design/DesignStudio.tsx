"use client";

// DesignStudio — تصميم المتجر الحالي، والحركة، وطلب تصميم جديد من الفريق («اطلب تعديل»)، واستعادة أي تصميم سابق.
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wand2, ExternalLink, Loader2, History, Palette, Type, LayoutTemplate, Sparkles, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { revertSnapshotAction } from "@/server/actions/blueprint";
import { saveMotionAction } from "@/server/actions/motion";
import { MotionPicker } from "@/components/dashboard/design/MotionPicker";

type Current = { concept: string; mood: string; colors: string[]; fonts: string; card: string; hero: string | null; motion: { level: "calm" | "lively" | "cinematic"; depth: boolean } } | null;
type Previous = { id: string; version: number; at: string; summary: { concept: string; colors: string[]; fonts: string } };

const CARD_LABEL: Record<string, string> = {
  minimal: "بسيطة",
  elevated: "مرتفعة بظل",
  bordered: "بإطار",
  editorial: "مجلة",
  overlay: "نص فوق الصورة",
  glass: "زجاجية",
  floating: "طافية",
  brutalist: "جريئة",
};

export function DesignStudio({ storeUrl, current, previous }: { storeUrl: string; current: Current; previous: Previous[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const restore = (id: string) =>
    start(async () => {
      const r = await revertSnapshotAction(id);
      if (r.ok) {
        toast.success("استعدنا التصميم السابق");
        router.refresh();
      } else toast.error(r.error);
    });

  return (
    <div className="mx-auto max-w-5xl space-y-6" dir="rtl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-black text-nova-2">تصميم المتجر</p>
          <h1 className="mt-1 text-2xl font-black text-ink md:text-3xl">متجرك مصمم خصيصاً لك</h1>
          <p className="mt-2 max-w-2xl text-[13.5px] leading-7 text-ink-2">
            فريق التصميم اختار ألوان متجرك وخطوطه وشكل كل بطاقة وزر وقسم من نشاطك ومنتجاتك، ونصوصه مبنية على سياساتك الفعلية.
          </p>
        </div>
        <a href={storeUrl} target="_blank" rel="noopener" className="inline-flex h-11 items-center gap-2 rounded-xl border border-edge/10 px-4 text-[13px] font-black text-ink transition hover:bg-edge/[0.05]">
          شاهد متجرك <ExternalLink className="size-4" />
        </a>
      </header>

      {current ? (
        <section className="dash-card grid gap-5 p-5 md:grid-cols-[1.2fr_1fr] md:p-6">
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-[12px] font-black text-ink-3">
              <Sparkles className="size-4 text-aurora" /> فكرة التصميم الحالية
            </p>
            <h2 className="text-xl font-black text-ink">{current.concept || "التصميم الأول لمتجرك"}</h2>
            {current.mood ? <p className="text-[13px] leading-7 text-ink-2">{current.mood}</p> : null}
          </div>
          <dl className="grid grid-cols-2 gap-3 text-[12.5px]">
            <div className="col-span-2 rounded-xl bg-edge/[0.03] p-3">
              <dt className="flex items-center gap-1.5 font-black text-ink-3">
                <Palette className="size-3.5" /> الألوان
              </dt>
              <dd className="mt-2 flex gap-2">
                {current.colors.map((c, i) => (
                  <span key={i} className="size-8 rounded-lg ring-1 ring-edge/15" style={{ background: c }} title={c} />
                ))}
              </dd>
            </div>
            <div className="rounded-xl bg-edge/[0.03] p-3">
              <dt className="flex items-center gap-1.5 font-black text-ink-3">
                <Type className="size-3.5" /> الخطوط
              </dt>
              <dd className="mt-1 font-bold text-ink">{current.fonts}</dd>
            </div>
            <div className="rounded-xl bg-edge/[0.03] p-3">
              <dt className="flex items-center gap-1.5 font-black text-ink-3">
                <LayoutTemplate className="size-3.5" /> البطاقات
              </dt>
              <dd className="mt-1 font-bold text-ink">{CARD_LABEL[current.card] ?? current.card}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {current ? <MotionSection initial={current.motion} /> : null}

      <section className="dash-card flex flex-wrap items-center justify-between gap-4 p-5 md:p-6">
        <div>
          <p className="text-[15px] font-black text-ink">تريد شكلاً مختلفاً؟</p>
          <p className="mt-1 text-[13px] leading-6 text-ink-2">اطلب من فريقنا تعديل التصميم أو هوية جديدة لمتجرك، ونحتفظ بتصميمك الحالي لتستعيده متى أردت.</p>
        </div>
        <Link href="/dashboard/requests?area=design" className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-l from-nova to-aurora px-5 text-[13.5px] font-black text-white shadow-lg shadow-nova/30">
          <Wand2 className="size-4" /> اطلب تعديل التصميم
        </Link>
      </section>

      {previous.length ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-[14px] font-black text-ink">
            <History className="size-4 text-ink-3" /> تصميمات سابقة
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {previous.map((p) => (
              <li key={p.id} className="dash-card flex flex-col gap-3 p-4">
                <div className="flex gap-1.5">
                  {p.summary.colors.map((c, i) => (
                    <span key={i} className="size-6 rounded-md ring-1 ring-edge/15" style={{ background: c }} />
                  ))}
                </div>
                <div>
                  <p className="text-[13.5px] font-black text-ink">{p.summary.concept}</p>
                  <p className="text-[11.5px] text-ink-3">
                    {p.summary.fonts} · {new Date(p.at).toLocaleDateString("ar-EG", { day: "numeric", month: "long" })}
                  </p>
                </div>
                <button type="button" onClick={() => restore(p.id)} disabled={pending} className="mt-auto inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-edge/10 text-[12.5px] font-black text-ink-2 transition hover:bg-edge/[0.05] disabled:opacity-50">
                  <RotateCcw className="size-3.5" /> استعد هذا التصميم
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** الحركة والعمق: يُحفظ كل تغيير فوراً ويظهر في المتجر خلال ثوانٍ. */
function MotionSection({ initial }: { initial: { level: "calm" | "lively" | "cinematic"; depth: boolean } }) {
  const [v, setV] = useState(initial);
  const [saving, start] = useTransition();
  const save = (next: typeof v) => {
    setV(next);
    start(async () => {
      const r = await saveMotionAction(next);
      if (!r.ok) return void toast.error(r.error);
      if (r.orbit === "on") toast.success("صارت واجهة متجرك حلقة من صور منتجاتك تدور، مع الحركة السينمائية");
      else if (r.orbit === "off") toast.success("حُفظت الحركة، وعادت الواجهة لتصميم ثابت");
      else if (r.orbit === "needs_images") toast.success("حُفظت الحركة السينمائية. حلقة الصور الدوّارة تظهر حين يصبح لديك 4 منتجات منشورة بصور");
      else toast.success("حُفظت حركة متجرك");
    });
  };
  return (
    <section className="dash-card space-y-4 p-5 md:p-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-[16px] font-black text-ink">الحركة والعمق</h2>
          <p className="mt-1 text-[12.5px] text-ink-2">كيف تظهر الواجهة والمنتجات لعملائك. التغيير فوري، و«سينمائي» يجعل الواجهة حلقة من صور منتجاتك.</p>
        </div>
        {saving ? <Loader2 className="size-4 animate-spin text-nova" /> : null}
      </div>
      <MotionPicker
        value={v.level}
        depth={v.depth}
        onChange={(level) => level !== "auto" && save({ ...v, level })}
        onDepth={(depth) => save({ ...v, depth })}
        hideAuto
      />
    </section>
  );
}
