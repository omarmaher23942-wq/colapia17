"use client";

// معاينة حية لمتجر التاجر داخل إطار موبايل، تتحدّث مع كل حرف يكتبه.
// الألوان هنا تقريبية حسب النشاط؛ الثيم النهائي يختاره الذكاء الاصطناعي من صور المنتجات.
import { motion, AnimatePresence } from "motion/react";
import { ShoppingBag, Check, Search } from "lucide-react";
import type { IndustryId } from "@/onboarding/schema";

const PALETTES: Record<IndustryId, { primary: string; accent: string; bg: string; ink: string }> = {
  fashion: { primary: "#1f2937", accent: "#e11d48", bg: "#fafaf9", ink: "#111827" },
  beauty: { primary: "#be185d", accent: "#f59e0b", bg: "#fff7fb", ink: "#3b0a24" },
  electronics: { primary: "#2563eb", accent: "#06b6d4", bg: "#f8fafc", ink: "#0f172a" },
  food: { primary: "#c2410c", accent: "#16a34a", bg: "#fffbf5", ink: "#2b1606" },
  home: { primary: "#0f766e", accent: "#d97706", bg: "#fbfaf7", ink: "#13201f" },
  kids: { primary: "#7c3aed", accent: "#f97316", bg: "#fffaf3", ink: "#1e1033" },
  accessories: { primary: "#92400e", accent: "#0ea5e9", bg: "#fdfaf6", ink: "#231507" },
  gifts: { primary: "#b91c1c", accent: "#eab308", bg: "#fffaf5", ink: "#2a0b0b" },
  health: { primary: "#15803d", accent: "#0891b2", bg: "#f7fdf9", ink: "#0b2414" },
  other: { primary: "#4f46e5", accent: "#ec4899", bg: "#fafaff", ink: "#111133" },
};

type Props = {
  name: string;
  subdomain: string;
  logo?: string;
  industry: IndustryId;
  products: { name: string; price: number; compareAt: number; image?: string }[];
  /** وعود حقيقية اختارها التاجر في الاستمارة (دفع عند الاستلام، معاينة، شحن مجاني...). */
  claims: string[];
  /** ألوان اختارها التاجر (أساسي، مساعد، خلفية) تحل محل ألوان النشاط. */
  colors?: readonly string[];
};

export function PhonePreview({ name, subdomain, logo, industry, products, claims, colors }: Props) {
  const base = PALETTES[industry];
  const p = colors?.length
    ? { ...base, primary: colors[0]!, accent: colors[1] ?? base.accent, bg: colors[2] && /^#f|^#e/i.test(colors[2]) ? colors[2] : base.bg }
    : base;
  const items = products.length ? products : Array.from({ length: 4 }, () => ({ name: "", price: 0, compareAt: 0, image: undefined }));

  return (
    <div className="relative mx-auto w-[300px]">
      <div aria-hidden="true" className="absolute -inset-6 rounded-[3rem] blur-3xl" style={{ background: `radial-gradient(circle, ${p.primary}55, transparent 70%)` }} />
      <div className="relative rounded-[2.6rem] border border-white/10 bg-[#0b0d18] p-2.5 shadow-2xl">
        <div className="absolute inset-x-0 top-2.5 z-10 mx-auto h-5 w-24 rounded-full bg-black" aria-hidden="true" />
        <div
          className="storefront h-[600px] overflow-hidden rounded-[2.1rem]"
          style={{ background: p.bg, color: p.ink, ["--primary" as string]: p.primary, ["--accent" as string]: p.accent, ["--motion-ease" as string]: "ease" }}
        >
          <div className="pt-9" />
          <div className="flex items-center justify-between px-4 py-2.5">
            <Search className="size-4 opacity-60" />
            <div className="flex min-w-0 items-center gap-2">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" className="size-7 rounded-lg object-cover" />
              ) : (
                <span className="grid size-7 place-items-center rounded-lg text-[12px] font-black text-white" style={{ background: p.primary }}>
                  {Array.from(name)[0]}
                </span>
              )}
              <AnimatePresence mode="popLayout">
                <motion.span key={name} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="truncate text-[14px] font-black">
                  {name}
                </motion.span>
              </AnimatePresence>
            </div>
            <ShoppingBag className="size-4 opacity-60" />
          </div>

          <div className="mx-3 overflow-hidden rounded-2xl p-4 text-white" style={{ background: `linear-gradient(135deg, ${p.primary}, ${p.accent})` }}>
            <p className="text-[10px] font-bold opacity-80">نصوص الواجهة يكتبها الذكاء الاصطناعي</p>
            <p className="mt-1 text-[16px] font-black leading-6">{name}</p>
            <span className="mt-3 inline-block rounded-full bg-white px-3 py-1 text-[10px] font-black" style={{ color: p.primary }}>
              تسوّق الآن
            </span>
          </div>

          {claims.length ? (
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 px-3 py-3 text-[9.5px] font-bold opacity-80">
              {claims.slice(0, 3).map((c) => (
                <span key={c} className="flex items-center gap-1">
                  <Check className="size-3" /> {c}
                </span>
              ))}
            </div>
          ) : (
            <div className="h-3" />
          )}

          {/* نفس قاعدة المتجر الحقيقي: منتج واحد يُعرض كبيراً لا وحيداً في شبكة. */}
          <div className={products.length === 1 ? "grid grid-cols-1 px-6" : "grid grid-cols-2 gap-2.5 px-3"}>
            {items.slice(0, 4).map((it, i) => (
              <div key={i} className="fluid-frame overflow-visible rounded-xl bg-white shadow-sm" style={{ borderRadius: "0.75rem" }}>
                <div className="aspect-square overflow-hidden rounded-t-xl" style={{ background: `${p.primary}12` }}>
                  {it.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.image} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="grid size-full place-items-center">
                      <ShoppingBag className="size-6 opacity-20" />
                    </div>
                  )}
                </div>
                <div className="space-y-1 p-2">
                  <p className="truncate text-[10.5px] font-bold">{it.name || "منتجك هنا"}</p>
                  <p className="text-[11px] font-black" style={{ color: p.primary }}>
                    {it.price ? `${it.price.toLocaleString("ar-EG")} ج.م` : "— ج.م"}
                    {it.compareAt > it.price ? (
                      <span className="ms-1 text-[9px] font-bold line-through opacity-50">{it.compareAt.toLocaleString("ar-EG")}</span>
                    ) : null}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-3 text-center font-mono text-[11px] text-ink-3" dir="ltr">
        {subdomain}.colapia.com
      </p>
    </div>
  );
}
