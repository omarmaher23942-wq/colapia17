"use client";

// WishlistButton — قلب المفضلة. على بطاقة المنتج يطفو في ركن الصورة، وفي صفحة المنتج بحجم أكبر.
import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useWishlist } from "@/store/wishlist";

export function WishlistButton({ slug, className, size = "sm" }: { slug: string; className?: string; size?: "sm" | "md" }) {
  const saved = useWishlist((s) => s.slugs.includes(slug));
  const toggle = useWishlist((s) => s.toggle);
  // لا نعرض الحالة المحفوظة قبل التحميل على المتصفح: يمنع اختلاف الـ HTML عن الخادم.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const on = ready && saved;
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const nowSaved = toggle(slug);
        toast(nowSaved ? "أُضيف إلى المفضلة" : "أُزيل من المفضلة", { action: { label: nowSaved ? "عرض القائمة" : "تراجع", onClick: () => (nowSaved ? window.location.assign("/wishlist") : toggle(slug)) }, duration: 4000 });
      }}
      className={cn(
        "grid place-items-center rounded-full border shadow-sm backdrop-blur transition-transform active:scale-90",
        size === "md" ? "size-11" : "size-9",
        className,
      )}
      style={{ background: "color-mix(in srgb, var(--background) 82%, transparent)", borderColor: "var(--border)", color: on ? "var(--danger, #e11d48)" : "var(--foreground)" }}
    >
      <Heart className={size === "md" ? "size-5" : "size-4"} strokeWidth={2} fill={on ? "currentColor" : "none"} aria-hidden="true" />
    </button>
  );
}
