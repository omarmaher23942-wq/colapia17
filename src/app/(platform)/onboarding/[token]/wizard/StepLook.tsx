"use client";

import {
  Palette,
  MessageSquareQuote,
  Wand2,
  Timer,
  Award,
  ShoppingBag,
  HelpCircle,
  BookOpen,
  Layers,
  Zap,
  Truck,
  MessageCircle,
  Flame,
  Sparkles,
  ClipboardCheck,
  Pencil,
  Star,
  Users,
  Clapperboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { governorateName } from "@/lib/egypt";
import type { OnboardingProduct } from "@/onboarding/schema";
import { ImageUploader } from "../components/ImageUploader";
import { Field, Section, StepHeading, SwitchCard, inputCls } from "./ui";
import { MotionPicker } from "./MotionPicker";
import { RECOMMENDED_FEATURES, type FeatureKey, type LaunchValue, type StepId, type StoreValue, type Tone } from "./model";

const PALETTES: { name: string; colors: string[] }[] = [
  { name: "ليلي فاخر", colors: ["#0f172a", "#c8a24a", "#f8f5ef"] },
  { name: "وردي ناعم", colors: ["#d9467a", "#fbe3ec", "#2b1a21"] },
  { name: "أخضر طبيعي", colors: ["#2f6b4f", "#e9f2ea", "#c48a3a"] },
  { name: "أزرق موثوق", colors: ["#1d4ed8", "#e8efff", "#0b1220"] },
  { name: "برتقالي حيوي", colors: ["#ea580c", "#fff3e8", "#1c1917"] },
  { name: "بنفسجي عصري", colors: ["#7c3aed", "#f3edff", "#151026"] },
  { name: "أحمر جريء", colors: ["#dc2626", "#fff1f1", "#111111"] },
  { name: "بيج هادئ", colors: ["#8b6b4a", "#f6efe6", "#2d241c"] },
];

const TONES: { id: Tone; label: string; sample: string }[] = [
  { id: "friendly_egyptian", label: "ودود مصري", sample: "منتجاتنا هتعجبك من أول مرة" },
  { id: "professional", label: "احترافي", sample: "جودة مضمونة وخدمة موثوقة" },
  { id: "luxury", label: "فاخر", sample: "تفاصيل تليق بذوقك الرفيع" },
  { id: "playful", label: "مرح", sample: "يلا نفرّح نفسنا شوية!" },
  { id: "minimal", label: "بسيط", sample: "جودة. بساطة. وضوح." },
];

const FEATURES: { key: FeatureKey; title: string; desc: string; icon: typeof Timer }[] = [
  { key: "marqueeBanner", title: "شريط إعلانات متحرك", desc: "رسائل الشحن والعروض أعلى المتجر", icon: Layers },
  { key: "stickyAddToCart", title: "زر شراء ثابت", desc: "يظهر أسفل الشاشة أثناء التصفح", icon: ShoppingBag },
  { key: "freeShippingBar", title: "شريط الشحن المجاني", desc: "«باقي لك X ج على الشحن المجاني»", icon: Truck },
  { key: "trustBadges", title: "شارات الثقة", desc: "الدفع عند الاستلام والمعاينة والاستبدال", icon: Award },
  { key: "socialProofToasts", title: "إشعارات الطلبات الحقيقية", desc: "«طلب جديد من القاهرة» بهدوء وبلا تكرار", icon: Users },
  { key: "whatsappDirectChat", title: "زر واتساب عائم", desc: "سؤال مباشر عن المنتج", icon: MessageCircle },
  { key: "lowStockAlert", title: "تنبيه الكمية المحدودة", desc: "«باقي 3 قطع فقط» من كميتك الحقيقية (مع تتبع المخزون)", icon: Flame },
  { key: "frequentlyBoughtTogether", title: "يُشترى معه عادةً", desc: "منتجات مكملة في صفحة المنتج", icon: Sparkles },
  { key: "exitIntentDiscount", title: "عرض عند المغادرة", desc: "خصم 10% لأول طلب بكود WELCOME10 ننشئه في متجرك", icon: Zap },
  { key: "faqSection", title: "أسئلة شائعة", desc: "إجابات عن الشحن والدفع والاستبدال", icon: HelpCircle },
  { key: "brandStory", title: "قصة المتجر", desc: "كلمة المؤسس ورسالة العلامة", icon: BookOpen },
  { key: "customerVoiceReviews", title: "آراء العملاء", desc: "تقييمات حقيقية من طلبات فعلية، تظهر مع أول تقييم", icon: Star },
];

export function StepLook({
  token,
  store,
  products,
  launch,
  setLaunch,
  onEdit,
}: {
  token: string;
  store: StoreValue;
  products: OnboardingProduct[];
  launch: LaunchValue;
  setLaunch: (p: Partial<LaunchValue>) => void;
  onEdit: (s: StepId) => void;
}) {
  const features = launch.features;
  const setFeature = (k: FeatureKey, v: boolean) => setLaunch({ features: { ...features, [k]: v } });
  const enabled = FEATURES.filter((f) => features[f.key]).length;

  return (
    <div className="space-y-6">
      <StepHeading eyebrow="الخطوة 5 من 5" title="الشكل والمميزات" sub="ألوان متجرك وأسلوب كلامه والمميزات التي ترفع مبيعاته. ثم راجع كل شيء وابدأ البناء." />

      <Section icon={Palette} title="ألوان متجرك">
        <SwitchCard
          icon={Wand2}
          title="اختر لي ألواناً تناسب نشاطي"
          sub="نصمم لوحة ألوان متناسقة عالية التباين من نشاطك وشعارك."
          on={launch.autoTheme}
          onChange={(v) => setLaunch({ autoTheme: v })}
        />
        {!launch.autoTheme ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PALETTES.map((p) => {
                const value = `${p.name}: ${p.colors.join(" ")}`;
                const active = launch.colorPreference === value;
                return (
                  <button
                    key={p.name}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setLaunch({ colorPreference: value })}
                    className={cn("rounded-2xl border p-2.5 text-start transition", active ? "border-nova/60 bg-nova/[0.12]" : "border-edge/10 hover:border-edge/25")}
                  >
                    <span className="flex h-8 overflow-hidden rounded-lg">
                      {p.colors.map((c) => (
                        <span key={c} className="flex-1" style={{ background: c }} />
                      ))}
                    </span>
                    <span className="mt-1.5 block text-[12px] font-black text-ink">{p.name}</span>
                  </button>
                );
              })}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="أو لونك الأساسي">
                <span className="flex items-center gap-2">
                  <input
                    type="color"
                    value={/#[0-9a-f]{6}/i.exec(launch.colorPreference ?? "")?.[0] ?? "#6f86ff"}
                    onChange={(e) => setLaunch({ colorPreference: `لون البراند ${e.target.value}` })}
                    aria-label="اختر لونك الأساسي"
                    className="h-11 w-16 cursor-pointer rounded-xl border border-edge/10 bg-transparent"
                  />
                  <span className="text-[12px] text-ink-3">نبني منه بقية الألوان بتباين مريح للقراءة.</span>
                </span>
              </Field>
              <Field label="صورة إلهام" hint="اختياري: نستخرج الألوان منها">
                <ImageUploader
                  token={token}
                  value={launch.colorInspirationImage ? [launch.colorInspirationImage] : []}
                  onChange={(v) => setLaunch({ colorInspirationImage: v[0] })}
                  max={1}
                  label="ارفع صورة"
                />
              </Field>
            </div>
          </div>
        ) : null}
      </Section>

      <Section icon={Clapperboard} title="حركة متجرك" sub="كيف تظهر الواجهة والمنتجات للعميل. جرّب كل اختيار لترى الفرق.">
        <MotionPicker value={launch.motionStyle ?? "auto"} depth={launch.depth3d ?? true} onChange={(v) => setLaunch({ motionStyle: v })} onDepth={(v) => setLaunch({ depth3d: v })} />
      </Section>

      <Section icon={MessageSquareQuote} title="أسلوب الكلام في متجرك" sub="يكتب به الذكاء الاصطناعي أوصاف المنتجات والعناوين.">
        <div role="radiogroup" aria-label="أسلوب الكلام" className="grid gap-2 sm:grid-cols-5">
          {TONES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={launch.toneOfVoice === t.id}
              onClick={() => setLaunch({ toneOfVoice: t.id })}
              className={cn("rounded-2xl border p-3 text-start transition", launch.toneOfVoice === t.id ? "border-nova/60 bg-nova/[0.12]" : "border-edge/10 hover:border-edge/25")}
            >
              <span className="block text-[12.5px] font-black text-ink">{t.label}</span>
              <span className="mt-1 block text-[11px] leading-5 text-ink-3">«{t.sample}»</span>
            </button>
          ))}
        </div>
        <Field label="قصة متجرك" hint="اختياري: نكتب منها صفحة «من نحن»">
          <textarea
            value={launch.founderStory ?? ""}
            onChange={(e) => setLaunch({ founderStory: e.target.value.slice(0, 1500) })}
            rows={3}
            placeholder="مثال: بدأنا من البيت سنة 2021 بخياطة طلبات صحابنا، ودلوقتي بنوصل لكل مصر..."
            className={cn(inputCls, "h-auto resize-y py-2.5 text-[13px] font-medium leading-6")}
          />
        </Field>
      </Section>

      <Section
        icon={Sparkles}
        title="مميزات تزيد مبيعاتك"
        sub={`مفعّل ${enabled} من ${FEATURES.length}. كلها قابلة للتشغيل والإيقاف من لوحة التحكم لاحقاً.`}
        action={
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setLaunch({ features: Object.fromEntries(FEATURES.map((f) => [f.key, RECOMMENDED_FEATURES.includes(f.key)])) })}
              className="rounded-xl bg-nova/15 px-3 py-1.5 text-[12px] font-black text-nova-2 hover:bg-nova/25"
            >
              الموصى به
            </button>
            <button
              type="button"
              onClick={() => setLaunch({ features: Object.fromEntries(FEATURES.map((f) => [f.key, true])) })}
              className="rounded-xl border border-edge/10 px-3 py-1.5 text-[12px] font-black text-ink-2 hover:bg-edge/[0.04]"
            >
              الكل
            </button>
          </div>
        }
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {FEATURES.map((f) => {
            const on = Boolean(features[f.key]);
            const Icon = f.icon;
            return (
              <button
                key={f.key}
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => setFeature(f.key, !on)}
                className={cn("flex items-center gap-3 rounded-2xl border p-3 text-start transition", on ? "border-nova/40 bg-nova/[0.08]" : "border-edge/10 hover:border-edge/20")}
              >
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", on ? "bg-nova text-white" : "bg-edge/[0.06] text-ink-3")}>
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-black text-ink">{f.title}</span>
                  <span className="block truncate text-[11px] text-ink-3">{f.desc}</span>
                </span>
                <span className={cn("relative h-5 w-9 shrink-0 rounded-full transition", on ? "bg-nova" : "bg-edge/15")} aria-hidden="true">
                  <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-all", on ? "start-[18px]" : "start-0.5")} />
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Review store={store} products={products} launch={launch} onEdit={onEdit} />
    </div>
  );
}

function Review({ store, products, launch, onEdit }: { store: StoreValue; products: OnboardingProduct[]; launch: LaunchValue; onEdit: (s: StepId) => void }) {
  const zonesOn = launch.zones.filter((z) => z.active);
  const shipping =
    launch.shippingMode === "free"
      ? "شحن مجاني لكل مصر"
      : launch.shippingMode === "flat"
        ? `${launch.flatFeeEgp} ج لكل المحافظات`
        : `حسب المحافظة (${zonesOn.length} محافظة، من ${Math.min(...zonesOn.map((z) => z.feeEgp))} إلى ${Math.max(...zonesOn.map((z) => z.feeEgp))} ج)`;
  const payments = [launch.codEnabled && "الدفع عند الاستلام", launch.vodafoneCashEnabled && "فودافون كاش", launch.instapayEnabled && "إنستاباي"].filter(Boolean).join("، ");
  const variants = products.reduce((n, p) => n + p.variants.length, 0);
  const rows: { step: StepId; label: string; value: string }[] = [
    { step: "identity", label: "المتجر", value: `${store.storeName || "بدون اسم"} · ${store.desiredSubdomain ?? ""}` },
    { step: "products", label: "المنتجات", value: `${products.length} منتج${variants ? ` · ${variants} تركيبة مقاس/لون` : ""}` },
    { step: "shipping", label: "الشحن", value: `${shipping} · ${launch.deliveryExpectedDays.min}-${launch.deliveryExpectedDays.max} أيام${launch.freeOverEgp ? ` · مجاني فوق ${launch.freeOverEgp} ج` : ""}` },
    { step: "policies", label: "الدفع", value: payments || "لم تُحدد" },
    {
      step: "policies",
      label: "الضمان",
      value: `${launch.inspectionAllowed ? "معاينة قبل الدفع · " : ""}${launch.returnDays ? `استبدال واسترجاع ${launch.returnDays} يوم` : "بدون استرجاع"}`,
    },
  ];
  const far = zonesOn.find((z) => z.governorate === "aswan");
  return (
    <section className="dash-card space-y-3 p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-[15px] font-black text-ink">
        <ClipboardCheck className="size-4.5 text-emerald-400" /> مراجعة سريعة قبل البناء
      </h2>
      <dl className="divide-y divide-edge/[0.06]">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start gap-3 py-2.5">
            <dt className="w-16 shrink-0 text-[12px] font-black text-ink-3">{r.label}</dt>
            <dd className="min-w-0 flex-1 text-[12.5px] leading-6 text-ink">{r.value}</dd>
            <button type="button" onClick={() => onEdit(r.step)} aria-label={`تعديل ${r.label}`} className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-edge/[0.06] hover:text-ink">
              <Pencil className="size-3.5" />
            </button>
          </div>
        ))}
      </dl>
      {far ? <p className="text-[11.5px] text-ink-3">مثال: عميل في {governorateName(far.governorate)} يدفع شحن {far.feeEgp} ج.</p> : null}
    </section>
  );
}
