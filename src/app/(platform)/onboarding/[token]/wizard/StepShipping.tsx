"use client";

import { useMemo, useState } from "react";
import { Truck, Map as MapIcon, Gift, Store, Clock, Wand2, Plus, Minus, ChevronDown, Banknote, Equal } from "lucide-react";
import { cn } from "@/lib/utils";
import { GOVERNORATES, governorateName } from "@/lib/egypt";
import type { ShippingZone } from "@/onboarding/schema";
import { Chips, ErrorText, Field, MoneyInput, NumberInput, QuickButton, Section, Segmented, SmartHint, StepHeading, SwitchCard, inputCls } from "./ui";
import { GROUPS, MARKET_RATES, groupOf, marketZones, type LaunchValue } from "./model";

const ETA_PRESETS = [
  { value: "1-2", label: "يوم ليومين" },
  { value: "2-4", label: "2 إلى 4 أيام" },
  { value: "3-5", label: "3 إلى 5 أيام" },
  { value: "5-7", label: "5 إلى 7 أيام" },
];

export function StepShipping({ launch, setLaunch, errors }: { launch: LaunchValue; setLaunch: (p: Partial<LaunchValue>) => void; errors: Record<string, string> }) {
  const zones = launch.zones.length ? launch.zones : marketZones();
  const setZones = (z: ShippingZone[]) => setLaunch({ zones: z });
  const days = launch.deliveryExpectedDays;

  const sample = useMemo(() => {
    if (launch.shippingMode === "free") return "الشحن مجاني لكل عملائك في كل المحافظات.";
    if (launch.shippingMode === "flat") return `عميلك في أي محافظة يدفع ${launch.flatFeeEgp} ج ويستلم خلال ${days.min} إلى ${days.max} أيام عمل.`;
    const far = zones.find((z) => z.governorate === "aswan" && z.active) ?? zones.filter((z) => z.active).at(-1);
    const near = zones.find((z) => z.governorate === "cairo" && z.active) ?? zones.find((z) => z.active);
    if (!near) return "فعّل المحافظات التي تشحن إليها.";
    return `عميلك في ${governorateName(near.governorate)} يدفع ${near.feeEgp} ج ويستلم خلال ${near.etaMinDays}-${near.etaMaxDays} أيام${far && far !== near ? `، وفي ${governorateName(far.governorate)} ${far.feeEgp} ج خلال ${far.etaMinDays}-${far.etaMaxDays} أيام` : ""}.`;
  }, [launch.shippingMode, launch.flatFeeEgp, days, zones]);

  return (
    <div className="space-y-6">
      <StepHeading eyebrow="الخطوة 3 من 5" title="الشحن والتوصيل" sub="حدد سعر الشحن ومدته، موحداً لكل مصر أو لكل محافظة. اخترنا لك أسعاراً قريبة من متوسط شركات الشحن، وتقدر تعدّلها بضغطة." />

      <Section icon={Truck} title="طريقة حساب الشحن">
        <Segmented
          label="طريقة حساب الشحن"
          value={launch.shippingMode}
          onChange={(m) => setLaunch(m === "zones" && !launch.zones.length ? { shippingMode: m, zones: marketZones() } : { shippingMode: m })}
          options={[
            { value: "flat", label: "سعر موحد", icon: Equal },
            { value: "zones", label: "لكل محافظة", icon: MapIcon },
            { value: "free", label: "مجاني", icon: Gift },
          ]}
        />

        {launch.shippingMode === "flat" ? (
          <div className="space-y-4">
            <Field label="سعر الشحن لأي محافظة">
              <div className="flex flex-wrap items-center gap-2">
                <Chips
                  label="سعر الشحن"
                  value={launch.flatFeeEgp}
                  onChange={(v) => setLaunch({ flatFeeEgp: v })}
                  options={[45, 55, 65, 75, 90].map((n) => ({ value: n, label: `${n} ج` }))}
                />
                <MoneyInput value={launch.flatFeeEgp} onChange={(v) => setLaunch({ flatFeeEgp: v })} placeholder="مبلغ آخر" className="w-28" />
              </div>
            </Field>
            <DaysField days={days} onChange={(d) => setLaunch({ deliveryExpectedDays: d })} error={errors.days} />
          </div>
        ) : null}

        {launch.shippingMode === "free" ? (
          <div className="space-y-4">
            <p className="rounded-xl bg-emerald-400/10 px-3.5 py-2.5 text-[12.5px] leading-6 text-emerald-600 dark:text-emerald-300">
              تتحمل أنت تكلفة الشحن. أضف قيمته في سعر المنتج حتى لا تخسر في الطلبات البعيدة.
            </p>
            <DaysField days={days} onChange={(d) => setLaunch({ deliveryExpectedDays: d })} error={errors.days} />
          </div>
        ) : null}

        {launch.shippingMode === "zones" ? <ZonesEditor zones={zones} onChange={setZones} error={errors.zones} /> : null}

        <SmartHint>{sample}</SmartHint>
      </Section>

      {launch.shippingMode !== "free" ? (
        <Section icon={Gift} title="شحن مجاني فوق مبلغ معين" sub="يرفع متوسط قيمة الطلب: يظهر للعميل شريط «باقي لك X ج على الشحن المجاني».">
          <div className="flex flex-wrap items-center gap-2">
            <Chips
              label="حد الشحن المجاني"
              value={launch.freeOverEgp ?? 0}
              onChange={(v) => setLaunch({ freeOverEgp: v || undefined })}
              options={[0, 500, 750, 1000, 1500].map((n) => ({ value: n, label: n ? `${n} ج` : "بدون" }))}
            />
            <MoneyInput value={launch.freeOverEgp} onChange={(v) => setLaunch({ freeOverEgp: v || undefined })} placeholder="مبلغ آخر" className="w-28" />
          </div>
        </Section>
      ) : null}

      <Section icon={Banknote} title="رسوم الدفع عند الاستلام" sub="بعض شركات الشحن تأخذ رسوماً على تحصيل الكاش. أضفها هنا أو اتركها صفراً.">
        <div className="flex flex-wrap items-center gap-2">
          <Chips
            label="رسوم الدفع عند الاستلام"
            value={launch.codFeeEgp}
            onChange={(v) => setLaunch({ codFeeEgp: v })}
            options={[0, 10, 15, 20].map((n) => ({ value: n, label: n ? `+${n} ج` : "بدون" }))}
          />
          <MoneyInput value={launch.codFeeEgp} onChange={(v) => setLaunch({ codFeeEgp: v })} placeholder="مبلغ آخر" className="w-28" />
        </div>
      </Section>

      <SwitchCard
        icon={Store}
        title="الاستلام من مقر المتجر"
        sub="العميل يختار الاستلام بنفسه بلا رسوم شحن."
        on={launch.pickupEnabled}
        onChange={(v) => setLaunch({ pickupEnabled: v })}
      >
        <Field label="عنوان الاستلام" error={errors.pickupAddress}>
          <input
            value={launch.pickupAddress ?? ""}
            onChange={(e) => setLaunch({ pickupAddress: e.target.value.slice(0, 200) })}
            placeholder="مثال: 12 شارع التحرير، الدقي، الجيزة"
            className={cn(inputCls, errors.pickupAddress && "border-rose-400/60")}
          />
        </Field>
      </SwitchCard>
    </div>
  );
}

function DaysField({ days, onChange, error }: { days: { min: number; max: number }; onChange: (d: { min: number; max: number }) => void; error?: string }) {
  const key = `${days.min}-${days.max}`;
  return (
    <Field label="مدة التوصيل" error={error}>
      <div className="flex flex-wrap items-center gap-2">
        <Chips
          label="مدة التوصيل"
          value={ETA_PRESETS.some((p) => p.value === key) ? key : ""}
          onChange={(v) => {
            const [min, max] = v.split("-").map(Number);
            onChange({ min: min ?? 2, max: max ?? 4 });
          }}
          options={ETA_PRESETS}
        />
        <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-3">
          <Clock className="size-3.5" /> من
          <NumberInput value={days.min} onChange={(n) => onChange({ ...days, min: n })} max={30} ariaLabel="أقل مدة" className="w-14" />
          إلى
          <NumberInput value={days.max} onChange={(n) => onChange({ ...days, max: n })} max={30} ariaLabel="أكبر مدة" className="w-14" />
          يوم
        </span>
      </div>
    </Field>
  );
}

function ZonesEditor({ zones, onChange, error }: { zones: ShippingZone[]; onChange: (z: ShippingZone[]) => void; error?: string }) {
  const [open, setOpen] = useState<string | null>("gc");
  const [uniform, setUniform] = useState(0);
  const shift = (delta: number) => onChange(zones.map((z) => ({ ...z, feeEgp: Math.max(0, z.feeEgp + delta) })));
  const patchGroup = (group: string, patch: Partial<ShippingZone>) => onChange(zones.map((z) => (groupOf(z.governorate) === group ? { ...z, ...patch } : z)));
  const patchOne = (code: string, patch: Partial<ShippingZone>) => onChange(zones.map((z) => (z.governorate === code ? { ...z, ...patch } : z)));
  const activeCount = zones.filter((z) => z.active).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <QuickButton icon={Wand2} onClick={() => onChange(marketZones())}>
          أسعار السوق المقترحة
        </QuickButton>
        <QuickButton icon={Plus} onClick={() => shift(5)}>
          5 ج للكل
        </QuickButton>
        <QuickButton icon={Minus} onClick={() => shift(-5)}>
          5 ج للكل
        </QuickButton>
        <span className="inline-flex items-center gap-1.5">
          <MoneyInput value={uniform} onChange={setUniform} placeholder="سعر موحد" className="w-28" />
          <QuickButton icon={Equal} onClick={() => uniform > 0 && onChange(zones.map((z) => ({ ...z, feeEgp: uniform })))}>
            طبّق على الكل
          </QuickButton>
        </span>
      </div>
      <p className="text-[12px] text-ink-3">
        تشحن إلى <b className="text-ink">{activeCount}</b> من {zones.length} محافظة. اضغط على أي منطقة لتعديل محافظاتها واحدة واحدة.
      </p>
      <ErrorText>{error}</ErrorText>

      <div className="space-y-2">
        {GROUPS.map((g) => {
          const list = zones.filter((z) => groupOf(z.governorate) === g.id);
          if (!list.length) return null;
          const on = list.filter((z) => z.active).length;
          const first = list.find((z) => z.active) ?? list[0]!;
          const uniformFee = list.every((z) => z.feeEgp === first.feeEgp);
          const isOpen = open === g.id;
          return (
            <div key={g.id} className={cn("rounded-2xl border transition", on ? "border-edge/10" : "border-edge/[0.06] opacity-70")}>
              <div className="space-y-2.5 p-3">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setOpen(isOpen ? null : g.id)} aria-expanded={isOpen} className="flex min-w-0 flex-1 items-center gap-2 text-start">
                    <ChevronDown className={cn("size-4 shrink-0 text-ink-3 transition", isOpen && "rotate-180")} />
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-black text-ink">{g.label}</span>
                      <span className="block truncate text-[11px] text-ink-3">
                        {on}/{list.length} محافظة{g.hint ? ` · ${g.hint}` : ""}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on > 0}
                    aria-label={`الشحن إلى ${g.label}`}
                    onClick={() => patchGroup(g.id, { active: on === 0 })}
                    className={cn("relative h-6 w-10 shrink-0 rounded-full transition", on ? "bg-emerald-500" : "bg-edge/20")}
                  >
                    <span className={cn("absolute top-1 size-4 rounded-full bg-white shadow transition-all", on ? "start-5" : "start-1")} />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 ps-6">
                  <MoneyInput
                    value={uniformFee ? first.feeEgp : undefined}
                    onChange={(v) => patchGroup(g.id, { feeEgp: v })}
                    placeholder={uniformFee ? "السعر" : "مختلفة"}
                    ariaLabel={`سعر الشحن لـ ${g.label}`}
                    className="w-24"
                  />
                  <span className="inline-flex items-center gap-1 text-[11.5px] text-ink-3">
                    خلال
                    <NumberInput value={first.etaMinDays} onChange={(n) => patchGroup(g.id, { etaMinDays: n })} max={30} ariaLabel={`أقل مدة لـ ${g.label}`} className="w-12" />-
                    <NumberInput value={first.etaMaxDays} onChange={(n) => patchGroup(g.id, { etaMaxDays: n })} max={30} ariaLabel={`أكبر مدة لـ ${g.label}`} className="w-12" />
                    يوم
                  </span>
                </div>
              </div>
              {isOpen ? (
                <ul className="divide-y divide-edge/[0.05] border-t border-edge/[0.06]">
                  {list.map((z) => (
                    <li key={z.governorate} className={cn("flex flex-wrap items-center gap-2 px-3 py-2.5", !z.active && "opacity-50")}>
                      <span className="w-full text-[12.5px] font-bold text-ink sm:w-auto sm:min-w-24 sm:flex-1">{governorateName(z.governorate)}</span>
                      <MoneyInput value={z.feeEgp} onChange={(v) => patchOne(z.governorate, { feeEgp: v })} ariaLabel={`سعر ${governorateName(z.governorate)}`} className="w-24" />
                      <span className="inline-flex items-center gap-1 text-[11.5px] text-ink-3">
                        <NumberInput value={z.etaMinDays} onChange={(n) => patchOne(z.governorate, { etaMinDays: n })} max={30} ariaLabel="أقل مدة" className="w-12" />-
                        <NumberInput value={z.etaMaxDays} onChange={(n) => patchOne(z.governorate, { etaMaxDays: n })} max={30} ariaLabel="أكبر مدة" className="w-12" />
                      </span>
                      <span className="flex-1 sm:hidden" />
                      <button
                        type="button"
                        role="switch"
                        aria-checked={z.active}
                        aria-label={`الشحن إلى ${governorateName(z.governorate)}`}
                        onClick={() => patchOne(z.governorate, { active: !z.active })}
                        className={cn("relative h-6 w-10 shrink-0 rounded-full transition", z.active ? "bg-emerald-500" : "bg-edge/20")}
                      >
                        <span className={cn("absolute top-1 size-4 rounded-full bg-white shadow transition-all", z.active ? "start-5" : "start-1")} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-ink-3">
        المقترح: القاهرة الكبرى {MARKET_RATES.gc.fee} ج، الدلتا {MARKET_RATES.delta.fee} ج، الصعيد {MARKET_RATES.upper.fee} ج، المحافظات البعيدة {MARKET_RATES.remote.fee} ج. عدد المحافظات: {GOVERNORATES.length}.
      </p>
    </div>
  );
}
