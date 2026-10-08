"use client";

import { useMemo, useState } from "react";
import { Banknote, Smartphone, Wallet, ShieldCheck, RotateCcw, Eye, Repeat, Undo2, Truck, ChevronDown, CreditCard, PackageX } from "lucide-react";
import { cn } from "@/lib/utils";
import { defaultBlueprint } from "@/blueprint/defaults";
import { generatePolicyPage } from "@/blueprint/policy-pages";
import { Markdown } from "@/components/storefront/Markdown";
import { Chips, ErrorText, Field, MultiChips, Section, StepHeading, SwitchCard, inputCls } from "./ui";
import { NON_RETURNABLE_PRESETS, RETURN_CONDITION_PRESETS, type DefectPolicy, type LaunchValue, type Payer, type StoreValue } from "./model";

const DEFECT_OPTIONS: { value: DefectPolicy; title: string; sub: string }[] = [
  { value: "replace_or_refund", title: "استبدال أو استرداد", sub: "العميل يختار، وهو الأعلى ثقة" },
  { value: "replace", title: "استبدال فقط", sub: "نرسل له قطعة سليمة" },
  { value: "refund", title: "استرداد فقط", sub: "نرد ثمن المنتج" },
  { value: "case_by_case", title: "حسب الحالة", sub: "نراجع الصورة ونتفق معه" },
  { value: "none", title: "لا التزام", sub: "لن نكتب أي التزام عن العيوب" },
];

const DEFECT_WINDOWS = [24, 48, 72, 168, 336, 720];

// شحن المرتجع العادي (تغيير رأي أو مقاس). المنتج المعيب له اختيار مستقل بالأسفل.
const PAYERS: { value: Payer; title: string; sub: string }[] = [
  { value: "customer", title: "العميل", sub: "الأكثر شيوعاً في مصر" },
  { value: "store", title: "المتجر", sub: "أقوى ثقة للعميل، وتكلفة أعلى عليك" },
];

export function StepPolicies({
  store,
  launch,
  setLaunch,
  errors,
}: {
  store: StoreValue;
  launch: LaunchValue;
  setLaunch: (p: Partial<LaunchValue>) => void;
  errors: Record<string, string>;
}) {
  const [preview, setPreview] = useState(false);
  const noReturns = launch.returnDays === 0;
  const nonReturnableList = (launch.nonReturnable ?? "")
    .split("، ")
    .map((s) => s.trim())
    .filter(Boolean);

  // نفس مولّد صفحة السياسة الذي يراه العميل في المتجر، فما يراه التاجر هنا هو ما سيُنشر حرفياً.
  const policy = useMemo(() => {
    if (!preview) return null;
    const bp = defaultBlueprint({ name: store.storeName?.trim() || "متجرك", phone: store.phone, storeId: "preview" } as never);
    const page = generatePolicyPage(
      {
        ...bp,
        shipping: { ...bp.shipping, inspectionAllowed: launch.inspectionAllowed },
        returns: {
          windowDays: launch.returnDays,
          allowExchange: launch.allowExchange,
          allowRefund: launch.allowRefund,
          returnShippingPaidBy: launch.returnShippingPaidBy,
          refundDays: launch.refundDays,
          conditions: launch.returnConditionsList,
          defectPolicy: launch.defectPolicy,
          defectReportHours: launch.defectReportHours,
          defectShippingByStore: launch.defectShippingByStore,
          ...(launch.nonReturnable ? { nonReturnable: launch.nonReturnable } : {}),
        },
      },
      "returns"
    );
    return page?.body ?? "";
  }, [preview, store.storeName, store.phone, launch]);

  return (
    <div className="space-y-6">
      <StepHeading eyebrow="الخطوة 4 من 5" title="الدفع والضمان" sub="كيف يدفع عملاؤك، وسياسة المعاينة والاستبدال. نكتب منها صفحات السياسات في متجرك تلقائياً، مطابقة لما تطبقه حرفياً." />

      <Section icon={CreditCard} title="طرق الدفع" sub="فعّل طريقة واحدة على الأقل.">
        <ErrorText>{errors.payment}</ErrorText>
        <div className="grid gap-2.5">
          <SwitchCard icon={Banknote} title="الدفع عند الاستلام" sub="العميل يدفع كاش للمندوب عند الباب." badge="الأكثر طلباً في مصر" on={launch.codEnabled} onChange={(v) => setLaunch({ codEnabled: v })} />
          <SwitchCard icon={Smartphone} title="فودافون كاش" sub="العميل يحوّل ويرفع صورة التحويل قبل الشحن." on={launch.vodafoneCashEnabled} onChange={(v) => setLaunch({ vodafoneCashEnabled: v })}>
            <Field label="رقم المحفظة الذي يحوّل عليه عملاؤك" error={errors.vodafoneCash}>
              <input
                value={launch.vodafoneCash ?? ""}
                onChange={(e) => setLaunch({ vodafoneCash: e.target.value.replace(/[^\d]/g, "").slice(0, 11) })}
                placeholder="010xxxxxxxx"
                inputMode="tel"
                dir="ltr"
                className={cn(inputCls, "text-end font-mono", errors.vodafoneCash && "border-rose-400/60")}
              />
            </Field>
          </SwitchCard>
          <SwitchCard icon={Wallet} title="إنستاباي" sub="تحويل بنكي فوري برفع صورة التحويل." on={launch.instapayEnabled} onChange={(v) => setLaunch({ instapayEnabled: v })}>
            <Field label="عنوان إنستاباي أو الرقم المربوط به" error={errors.instapayAddress}>
              <input
                value={launch.instapayAddress ?? ""}
                onChange={(e) => setLaunch({ instapayAddress: e.target.value.slice(0, 80) })}
                placeholder="name@instapay"
                dir="ltr"
                className={cn(inputCls, "text-end", errors.instapayAddress && "border-rose-400/60")}
              />
            </Field>
          </SwitchCard>
        </div>
      </Section>

      <SwitchCard
        icon={Eye}
        title="المعاينة قبل الدفع"
        sub="العميل يفتح الشحنة ويفحص المنتج مع المندوب قبل أن يدفع. ترفع ثقة الشراء جداً في مصر."
        badge="موصى به"
        on={launch.inspectionAllowed}
        onChange={(v) => setLaunch({ inspectionAllowed: v })}
      />

      <Section icon={RotateCcw} title="سياسة الاستبدال والاسترجاع" sub="اختر ما تطبقه فعلاً. قانون حماية المستهلك يعطي العميل حق الاسترجاع خلال 14 يوماً في أغلب المنتجات.">
        <Field label="المدة المسموح بها بعد الاستلام">
          <Chips
            label="مدة الاستبدال"
            value={launch.returnDays}
            onChange={(v) => setLaunch({ returnDays: v })}
            options={[0, 3, 7, 14, 30].map((d) => ({ value: d, label: d ? `${d} يوم` : "لا يوجد" }))}
          />
        </Field>

        {noReturns ? (
          <p className="rounded-xl bg-amber-400/10 px-3.5 py-2.5 text-[12.5px] leading-6 text-amber-600 dark:text-amber-300">
            سنكتب أن المنتجات لا تُستبدل ولا تُسترجع بعد الاستلام{launch.inspectionAllowed ? "، وأن المعاينة قبل الدفع متاحة" : ""}. واختر بالأسفل كيف تتعامل مع المنتج المعيب.
          </p>
        ) : (
          <div className="space-y-5">
            <ErrorText>{errors.returns}</ErrorText>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <SwitchCard icon={Repeat} title="استبدال" sub="بمقاس أو لون أو منتج آخر" on={launch.allowExchange} onChange={(v) => setLaunch({ allowExchange: v })} />
              <SwitchCard icon={Undo2} title="استرجاع المبلغ" sub="رد الفلوس كاملة للعميل" on={launch.allowRefund} onChange={(v) => setLaunch({ allowRefund: v })} />
            </div>

            <Field label="شحن المرتجع (تغيير رأي أو مقاس) على">
              <div role="radiogroup" aria-label="من يدفع شحن المرتجع" className="grid grid-cols-2 gap-2">
                {PAYERS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    role="radio"
                    aria-checked={(launch.returnShippingPaidBy === "store" ? "store" : "customer") === p.value}
                    onClick={() => setLaunch({ returnShippingPaidBy: p.value })}
                    className={cn(
                      "rounded-2xl border p-3 text-start transition",
                      (launch.returnShippingPaidBy === "store" ? "store" : "customer") === p.value ? "border-nova/60 bg-nova/[0.12]" : "border-edge/10 hover:border-edge/25"
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-[12.5px] font-black text-ink">
                      <Truck className="size-3.5 text-nova-2" /> {p.title}
                    </span>
                    <span className="mt-1 block text-[11px] leading-5 text-ink-3">{p.sub}</span>
                  </button>
                ))}
              </div>
            </Field>

            {launch.allowRefund ? (
              <Field label="رد المبلغ خلال">
                <Chips label="مدة رد المبلغ" value={launch.refundDays} onChange={(v) => setLaunch({ refundDays: v })} options={[3, 7, 14].map((d) => ({ value: d, label: `${d} أيام عمل` }))} />
              </Field>
            ) : null}

            <Field label="شروط القبول" hint="اختر ما يناسبك">
              <MultiChips label="شروط القبول" options={RETURN_CONDITION_PRESETS} value={launch.returnConditionsList} onChange={(v) => setLaunch({ returnConditionsList: v.slice(0, 8) })} />
            </Field>

            <Field label="منتجات لا تُستبدل ولا تُسترجع" hint="اختياري">
              <MultiChips
                label="منتجات لا تُستبدل"
                options={NON_RETURNABLE_PRESETS}
                value={nonReturnableList}
                onChange={(v) => setLaunch({ nonReturnable: v.join("، ") || undefined })}
              />
            </Field>
          </div>
        )}

        <div className="space-y-3 rounded-2xl border border-edge/10 p-4">
          <p className="flex items-center gap-2 text-[13px] font-black text-ink">
            <PackageX className="size-4 text-nova-2" aria-hidden="true" /> إذا وصل المنتج معيباً أو مخالفاً للطلب
          </p>
          <div role="radiogroup" aria-label="التعامل مع المنتج المعيب" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            {DEFECT_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={launch.defectPolicy === o.value}
                onClick={() => setLaunch({ defectPolicy: o.value })}
                className={cn(
                  "rounded-2xl border p-3 text-start transition",
                  launch.defectPolicy === o.value ? "border-nova/60 bg-nova/[0.12]" : "border-edge/10 hover:border-edge/25"
                )}
              >
                <span className="block text-[12.5px] font-black text-ink">{o.title}</span>
                <span className="mt-1 block text-[11px] leading-5 text-ink-3">{o.sub}</span>
              </button>
            ))}
          </div>
          {launch.defectPolicy !== "none" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="مهلة إبلاغك بالعيب">
                <Chips
                  label="مهلة الإبلاغ"
                  value={launch.defectReportHours}
                  onChange={(v) => setLaunch({ defectReportHours: v })}
                  options={DEFECT_WINDOWS.map((h) => ({ value: h, label: h < 72 ? `${h} ساعة` : `${h / 24} ${h / 24 <= 10 ? "أيام" : "يوماً"}` }))}
                />
              </Field>
              {launch.defectPolicy !== "case_by_case" ? (
                <Field label="شحن المنتج المعيب على">
                  <Chips
                    label="شحن المعيب"
                    value={launch.defectShippingByStore ? "store" : "customer"}
                    onChange={(v) => setLaunch({ defectShippingByStore: v === "store" })}
                    options={[
                      { value: "store", label: "المتجر" },
                      { value: "customer", label: "العميل" },
                    ]}
                  />
                </Field>
              ) : null}
            </div>
          ) : (
            <p className="text-[11.5px] leading-5 text-ink-3">لن تذكر صفحة السياسة أي التزام عن العيوب. تذكّر أن قانون حماية المستهلك يحفظ للعميل حقه في المنتج المعيب.</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setPreview((o) => !o)}
          aria-expanded={preview}
          className="flex w-full items-center justify-between rounded-xl border border-nova/30 bg-nova/[0.06] px-4 py-3 text-[13px] font-black text-ink transition hover:bg-nova/10"
        >
          <span className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-nova-2" /> هكذا ستظهر سياستك لعملائك
          </span>
          <ChevronDown className={cn("size-4 transition", preview && "rotate-180")} />
        </button>
        {preview && policy ? (
          <div className="max-h-96 overflow-y-auto rounded-2xl border border-edge/10 bg-edge/[0.02] p-4 text-[13px] leading-7 text-ink-2 [&_h2]:mt-4 [&_h2]:text-[14px] [&_h2]:font-black [&_h2]:text-ink [&_li]:ms-4 [&_li]:list-disc">
            <Markdown text={policy} className="" />
          </div>
        ) : null}
      </Section>
    </div>
  );
}
