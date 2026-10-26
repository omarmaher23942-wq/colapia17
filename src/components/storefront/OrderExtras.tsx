"use client";

// OrderExtras — أدوات الزائر بعد الطلب: موعد الوصول المتوقع مع «إضافة للتقويم» (ملف ICS)، نسخ رقم الشحنة،
// و«تواصلوا مع المتجر بخصوص هذا الطلب» برسالة واتساب جاهزة برقم الطلب.
import { CalendarPlus, Check, Copy, MessageCircle } from "lucide-react";
import { useState } from "react";
import { deliveryIcs } from "@/lib/shopper-ui";
import { waLink } from "@/lib/whatsapp";

const fmt = (iso: string) => new Intl.DateTimeFormat("ar-EG-u-nu-latn", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Cairo" }).format(new Date(iso));

export function OrderExtras({ code, storeName, whatsapp, etaFrom, etaTo, tracking }: { code: string; storeName: string; whatsapp?: string | null; etaFrom?: string | null; etaTo?: string | null; tracking?: string | null }) {
  const [copied, setCopied] = useState(false);
  const wa = waLink(whatsapp, `أهلاً ${storeName}، أستفسر عن طلبي رقم ${code}.`);

  const downloadIcs = () => {
    if (!etaFrom || !etaTo) return;
    const blob = new Blob([deliveryIcs({ code, storeName, from: new Date(etaFrom), to: new Date(etaTo) })], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `order-${code}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  if (!etaFrom && !wa && !tracking) return null;
  return (
    <div className="mt-4 space-y-3 text-start">
      {etaFrom && etaTo ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 text-sm" style={{ borderColor: "var(--border)" }}>
          <p className="font-bold">
            الوصول المتوقع: {etaFrom === etaTo ? fmt(etaFrom) : `من ${fmt(etaFrom)} إلى ${fmt(etaTo)}`}
          </p>
          <button type="button" onClick={downloadIcs} className="inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-bold" style={{ borderColor: "var(--border)" }}>
            <CalendarPlus className="size-4" aria-hidden="true" /> إضافة للتقويم
          </button>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {tracking ? (
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(tracking).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500))).catch(() => undefined)}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-bold"
            style={{ borderColor: "var(--border)" }}
          >
            {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
            {copied ? "تم النسخ" : "نسخ رقم الشحنة"}
          </button>
        ) : null}
        {wa ? (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-bold" style={{ borderColor: "var(--border)" }}>
            <MessageCircle className="size-4" aria-hidden="true" /> تواصلوا مع المتجر بخصوص الطلب
          </a>
        ) : null}
      </div>
    </div>
  );
}
