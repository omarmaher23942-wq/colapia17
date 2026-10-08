"use client";

import { useState } from "react";
import { Sparkles, Phone, AtSign, ChevronDown, Instagram, Facebook, Music2, Mail, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { INDUSTRY_IDS } from "@/onboarding/schema";
import { INDUSTRY_LABELS, INDUSTRY_ICONS, INDUSTRY_HINTS, INDUSTRY_SMART_DEFAULTS } from "../constants";
import { SubdomainField } from "../components/SubdomainField";
import { ImageUploader } from "../components/ImageUploader";
import { ErrorText, Field, Section, StepHeading, inputCls } from "./ui";
import type { StoreValue } from "./model";

export function StepIdentity({
  token,
  store,
  setStore,
  errors,
}: {
  token: string;
  store: StoreValue;
  setStore: (p: Partial<StoreValue>) => void;
  errors: Record<string, string>;
}) {
  const [moreChannels, setMoreChannels] = useState(Boolean(store.instagramHandle || store.facebookPageUrl || store.tiktokHandle || store.email));
  const separateWhatsapp = Boolean(store.whatsapp && store.whatsapp !== store.phone);
  const [ownWhatsapp, setOwnWhatsapp] = useState(separateWhatsapp);

  return (
    <div className="space-y-6">
      <StepHeading eyebrow="الخطوة 1 من 5" title="هوية متجرك" sub="الاسم والرابط ونوع النشاط وطرق تواصل عملائك معك. كل شيء قابل للتعديل لاحقاً من لوحة التحكم." />

      <Section icon={Sparkles} title="المتجر وصاحبه">
        <Field label="اسم المتجر" error={errors.storeName} htmlFor="storeName">
          <input
            id="storeName"
            value={store.storeName ?? ""}
            onChange={(e) => setStore({ storeName: e.target.value })}
            placeholder="مثال: بيت الأناقة"
            maxLength={80}
            aria-invalid={!!errors.storeName || undefined}
            className={cn(inputCls, "h-14 text-lg font-black", errors.storeName && "border-rose-400/60")}
          />
        </Field>
        <Field label="اسمك" hint="نناديك به في لوحة التحكم ونكتبه في قصة المتجر" error={errors.ownerName} htmlFor="ownerName">
          <input
            id="ownerName"
            value={store.ownerName ?? ""}
            onChange={(e) => setStore({ ownerName: e.target.value })}
            placeholder="مثال: مياده أحمد"
            maxLength={80}
            autoComplete="name"
            aria-invalid={!!errors.ownerName}
            className={cn(inputCls, errors.ownerName && "border-rose-400/60")}
          />
        </Field>
        <SubdomainField token={token} value={store.desiredSubdomain ?? ""} onChange={(v) => setStore({ desiredSubdomain: v })} error={errors.desiredSubdomain} />
      </Section>

      <Section icon={Sparkles} title="نوع نشاطك" sub="نختار على أساسه شكل الأقسام والمقاسات المقترحة وأسلوب الكتابة.">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          {INDUSTRY_IDS.map((id) => {
            const Icon = INDUSTRY_ICONS[id];
            const active = store.industry === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setStore({ industry: id })}
                aria-pressed={active}
                className={cn(
                  "group flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-center transition",
                  active ? "border-nova/60 bg-nova/[0.12] shadow-lg shadow-nova/20" : "border-edge/10 bg-edge/[0.02] hover:border-edge/20 hover:bg-edge/[0.05]"
                )}
              >
                <Icon className={cn("size-5 transition-transform group-hover:scale-110", active ? "text-nova-2" : "text-ink-3")} strokeWidth={1.8} />
                <span className="text-[12px] font-black text-ink">{INDUSTRY_LABELS[id]}</span>
                <span className="text-[10.5px] leading-4 text-ink-3">{INDUSTRY_HINTS[id]}</span>
              </button>
            );
          })}
        </div>
        {store.industry && INDUSTRY_SMART_DEFAULTS[store.industry].taglineSuggestion ? (
          <p className="flex items-center gap-1.5 text-[12px] text-ink-3">
            <Sparkles className="size-3.5 text-aurora" aria-hidden="true" />
            شعار مقترح لمتجرك: «{INDUSTRY_SMART_DEFAULTS[store.industry].taglineSuggestion}»
          </p>
        ) : null}
      </Section>

      <Section icon={Phone} title="التواصل والشعار">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="موبايل المتجر" hint="للتأكيد مع العملاء والشحن" error={errors.phone} htmlFor="phone">
            <input
              id="phone"
              value={store.phone ?? ""}
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d]/g, "").slice(0, 11);
                setStore(ownWhatsapp ? { phone: v } : { phone: v, whatsapp: v });
              }}
              inputMode="tel"
              autoComplete="tel"
              placeholder="01xxxxxxxxx"
              dir="ltr"
              className={cn(inputCls, "h-12 text-end font-mono tracking-wider", errors.phone && "border-rose-400/60")}
            />
            <label className="flex cursor-pointer items-center gap-2 text-[12px] text-ink-2">
              <input
                type="checkbox"
                checked={ownWhatsapp}
                onChange={(e) => {
                  setOwnWhatsapp(e.target.checked);
                  if (!e.target.checked) setStore({ whatsapp: store.phone });
                }}
                className="size-4 rounded accent-[var(--color-nova,#6f86ff)]"
              />
              رقم واتساب مختلف
            </label>
            {ownWhatsapp ? (
              <div className="relative">
                <MessageCircle className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-emerald-400" aria-hidden="true" />
                <input
                  value={store.whatsapp ?? ""}
                  onChange={(e) => setStore({ whatsapp: e.target.value.replace(/[^\d]/g, "").slice(0, 11) })}
                  inputMode="tel"
                  placeholder="رقم واتساب"
                  aria-label="رقم واتساب"
                  dir="ltr"
                  aria-invalid={!!errors.whatsapp || undefined}
                  className={cn(inputCls, "ps-9 text-end font-mono", errors.whatsapp && "border-rose-400/60")}
                />
              </div>
            ) : null}
            <ErrorText>{ownWhatsapp ? errors.whatsapp : undefined}</ErrorText>
          </Field>
          <Field label="الشعار" hint="اختياري، ونكتب اسمك بخط أنيق إن تركته">
            <ImageUploader token={token} value={store.logo ? [store.logo] : []} onChange={(v) => setStore({ logo: v[0] })} max={1} label="ارفع الشعار" />
          </Field>
        </div>

        <button
          type="button"
          onClick={() => setMoreChannels((o) => !o)}
          aria-expanded={moreChannels}
          className="flex w-full items-center justify-between rounded-xl border border-edge/10 px-4 py-3 text-[13px] font-black text-ink-2 transition hover:bg-edge/[0.03]"
        >
          <span className="flex items-center gap-2">
            <AtSign className="size-4 text-nova-2" /> حسابات التواصل الاجتماعي والبريد
            <span className="text-[11px] font-bold text-ink-3">(تظهر في تذييل متجرك)</span>
          </span>
          <ChevronDown className={cn("size-4 transition", moreChannels && "rotate-180")} />
        </button>
        {moreChannels ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <IconInput icon={Instagram} label="إنستجرام" placeholder="اسم الحساب بدون @" value={store.instagramHandle} onChange={(v) => setStore({ instagramHandle: v.replace(/^@+/, "") })} />
            <IconInput icon={Music2} label="تيك توك" placeholder="اسم الحساب بدون @" value={store.tiktokHandle} onChange={(v) => setStore({ tiktokHandle: v.replace(/^@+/, "") })} />
            <IconInput
              icon={Facebook}
              label="صفحة فيسبوك"
              placeholder="https://facebook.com/..."
              value={store.facebookPageUrl}
              onChange={(v) => setStore({ facebookPageUrl: v })}
              error={errors.facebookPageUrl}
            />
            <IconInput icon={Mail} label="بريد المتجر" placeholder="hello@..." value={store.email} onChange={(v) => setStore({ email: v })} type="email" />
          </div>
        ) : null}
      </Section>
    </div>
  );
}

function IconInput({
  icon: Icon,
  label,
  placeholder,
  value,
  onChange,
  error,
  type = "text",
}: {
  icon: typeof Mail;
  label: string;
  placeholder: string;
  value?: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[12px] font-black text-ink-2">{label}</span>
      <span className="relative block">
        <Icon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
        <input
          type={type}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value.trim())}
          placeholder={placeholder}
          dir="ltr"
          className={cn(inputCls, "ps-9 text-end text-[13px]", error && "border-rose-400/60")}
        />
      </span>
      <ErrorText>{error}</ErrorText>
    </label>
  );
}
