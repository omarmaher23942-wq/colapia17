"use client";

// ProductInfoPanel — «الشحن والاستبدال» في صفحة المنتج كأكورديون: تفاصيل حقائق المتجر الفعلية فقط
// (الدفع عند الاستلام، المعاينة، الاستبدال، الشحن المجاني، التغطية) مع روابط السياسات الكاملة. لا تظهر بلا حقائق.
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Icon } from "../Icon";
import { useStore } from "../StoreProvider";

const ORDER = ["cod", "inspection", "returns", "defect", "free_shipping", "free_shipping_over", "fast_delivery", "nationwide", "coverage", "wallets"];

export function ProductInfoPanel() {
  const { facts } = useStore();
  const rows = facts.filter((f) => ORDER.includes(f.key)).sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key));
  if (!rows.length) return null;
  const hasReturns = rows.some((r) => r.key === "returns");
  const hasShipping = rows.some((r) => /shipping|delivery|nationwide|coverage/.test(r.key));
  return (
    <details className="group mt-6 rounded-2xl border" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-black focus-visible:outline-none focus-visible:ring-2 [&::-webkit-details-marker]:hidden">
        الشحن والدفع والاستبدال
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <ul className="space-y-3 border-t px-4 py-4 text-[13px] leading-6" style={{ borderColor: "var(--border)" }}>
        {rows.map((r) => (
          <li key={r.key} className="flex gap-3">
            <Icon name={r.icon} className="mt-1 size-4 shrink-0 text-[var(--primary)]" />
            <span>
              <b className="block">{r.title}</b>
              <span className="opacity-80">{r.detail}</span>
            </span>
          </li>
        ))}
        {hasShipping || hasReturns ? (
          <li className="flex flex-wrap gap-x-5 gap-y-1 pt-1 text-[12.5px] font-bold">
            {hasShipping ? <Link href="/pages/shipping" className="underline underline-offset-4">سياسة الشحن</Link> : null}
            {hasReturns ? <Link href="/pages/returns" className="underline underline-offset-4">سياسة الاستبدال والاسترجاع</Link> : null}
          </li>
        ) : null}
      </ul>
    </details>
  );
}
