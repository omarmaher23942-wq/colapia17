// StoreLogo — شعار المتجر في الهيدر والفوتر (مكوّن واحد للمكانين).
//
// سبب عدم ظهور الشعار المرفوع (الخلل الجذري): الهيدر كان يُخفي أي رابط شعار يحتوي «colapia» أو «logo.png»
// ظناً أنه شعار المنصة، بينما كل ملف يُرفع إلى مساحة الصور يُخدم من media.colapia.com، فكان كل شعار حقيقي يُستبعد
// ويظهر الاسم نصاً. الآن: أي شعار في bp.brand.logo يُعرض كما هو.
//
// <img> عادي لا next/image: الشعار صغير، وقد يكون SVG أو من مضيف لم يُضبط في إعدادات الصور وقت البناء، وارتفاعه
// محجوز بالـ CSS فلا قفزة في التخطيط. النسخة الداكنة (logoDark) تظهر تلقائياً لمن جهازه داكن إن وُجدت.
import type { StoreBlueprint } from "@/blueprint/schema";
import { cn } from "@/lib/utils";

export function StoreLogo({
  brand,
  size = "md",
  priority = false,
  className,
  textClassName,
  scheme = "light",
}: {
  /** خلفية المتجر: داكنة ثابتة ⇒ النسخة الداكنة من الشعار إن وُجدت، وتلقائية ⇒ حسب جهاز الزائر. */
  scheme?: "light" | "dark" | "auto";
  brand: Pick<StoreBlueprint["brand"], "name" | "logo" | "logoDark">;
  size?: "sm" | "md" | "lg" | "xl";
  priority?: boolean;
  className?: string;
  textClassName?: string;
}) {
  const h = { sm: "h-7", md: "h-8 sm:h-9", lg: "h-9 sm:h-11", xl: "h-12 sm:h-14" }[size];
  const dark = brand.logoDark?.url;
  const url = scheme === "dark" && dark ? dark : brand.logo?.url;
  if (!url) {
    return (
      <span
        className={cn(
          "font-heading font-black leading-none tracking-tight",
          size === "lg" || size === "xl" ? "text-2xl sm:text-3xl" : size === "sm" ? "text-lg sm:text-xl" : "text-xl sm:text-2xl",
          textClassName
        )}
      >
        {brand.name}
      </span>
    );
  }
  /* eslint-disable @next/next/no-img-element */
  const img = (
    <img
      src={url}
      alt={brand.logo?.alt || brand.name}
      className={cn("block w-auto max-w-[11rem] object-contain sm:max-w-[14rem]", h, className)}
      decoding="async"
      fetchPriority={priority ? "high" : undefined}
      loading={priority ? "eager" : "lazy"}
    />
  );
  return dark && scheme === "auto" ? (
    <picture>
      <source srcSet={dark} media="(prefers-color-scheme: dark)" />
      {img}
    </picture>
  ) : (
    img
  );
  /* eslint-enable @next/next/no-img-element */
}
