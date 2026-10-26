"use client";

// PdpExtras — شريط تنقل سريع بين أقسام صفحة المنتج (الوصف، المواصفات، التقييمات، الأسئلة)، وتلميح الشحن المجاني
// الحي: يحسب المتبقي من سلة الزائر الحالية + سعر هذا المنتج، ويظهر فقط إن حدّد المتجر حداً للشحن المجاني.
import { Truck } from "lucide-react";
import { useCart } from "@/store/cart";
import { useStore } from "../StoreProvider";
import { formatEgp } from "@/lib/money";

export function PdpAnchors({ items }: { items: { id: string; label: string }[] }) {
  if (items.length < 2) return null;
  return (
    <nav aria-label="أقسام الصفحة" className="hide-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
      {items.map((i) => (
        <a key={i.id} href={`#${i.id}`} className="inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-[13px] font-bold hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2" style={{ borderColor: "var(--border)" }}>
          {i.label}
        </a>
      ))}
    </nav>
  );
}

export function FreeShippingHint({ pricePiasters }: { pricePiasters: number }) {
  const { shipping } = useStore();
  const items = useCart((s) => s.items);
  const threshold = shipping.freeOverPiasters;
  if (!threshold) return null;
  const cart = items.reduce((a, i) => a + i.unitPiasters * i.qty, 0);
  const remaining = threshold - (cart + pricePiasters);
  return (
    <p className="mt-3 flex items-center gap-2 text-[12.5px] font-bold" style={{ color: "var(--primary)" }}>
      <Truck className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      {remaining > 0 ? `أضيفوا ${formatEgp(remaining)} فقط إلى سلتكم للحصول على شحن مجاني` : "طلبكم مع هذا المنتج يحصل على شحن مجاني"}
    </p>
  );
}
