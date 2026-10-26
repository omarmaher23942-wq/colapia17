"use client";

// CartActions — إجراءات مساعدة أسفل السلة: الطلب عبر واتساب برسالة جاهزة، مشاركة السلة مع من يُستشار،
// تفريغ السلة مع «تراجع»، وموعد التوصيل العام إن حدّده المتجر. تظهر فقط ما ينطبق على المتجر فعلاً.
import { useEffect, useState } from "react";
import { Share2, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import { BrandIcon } from "./brand-icons";
import { useCart } from "@/store/cart";
import { useStore } from "./StoreProvider";
import { waLink } from "@/lib/whatsapp";
import { cartShareText, cartWhatsappMessage } from "@/lib/shopper-ui";

export function CartActions({ totalPiasters }: { totalPiasters: number }) {
  const { channels, brand, shipping } = useStore();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const restoreAll = useCart((s) => s.restoreAll);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  if (!items.length) return null;

  const lines = items.map((i) => ({ name: i.name, qty: i.qty, unitPiasters: i.unitPiasters, variantLabel: i.variantLabel, slug: i.slug }));
  const wa = waLink(channels.whatsappNumber, cartWhatsappMessage(lines, { storeName: brand.name, totalPiasters, url: origin || undefined }));

  const share = async () => {
    const text = cartShareText(lines, origin, brand.name);
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast.success("تم نسخ قائمة المنتجات للمشاركة");
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") toast.error("تعذّرت المشاركة");
    }
  };

  const onClear = () => {
    const snapshot = items;
    clear();
    toast("تم تفريغ السلة", { action: { label: "تراجع", onClick: () => restoreAll(snapshot) }, duration: 7000 });
  };

  return (
    <div className="space-y-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
      {shipping.generalEta ? (
        <p className="flex items-center gap-2 text-[12.5px] opacity-80">
          <Truck className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          التوصيل: {shipping.generalEta}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {wa ? (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="s-btn-ghost h-10 flex-1 gap-1.5 px-3 text-[12.5px]">
            <BrandIcon brand="whatsapp" className="size-4" />
            اطلبوا عبر واتساب
          </a>
        ) : null}
        <button type="button" onClick={share} className="s-btn-ghost h-10 gap-1.5 px-3 text-[12.5px]">
          <Share2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
          مشاركة السلة
        </button>
        <button type="button" onClick={onClear} className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-bold text-danger hover:bg-danger/10">
          <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
          تفريغ
        </button>
      </div>
    </div>
  );
}
