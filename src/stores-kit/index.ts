// stores-kit — الواجهة الوحيدة المسموح لكود المتاجر الخاصة (stores/<slug>/**) باستيرادها من النواة.
// يفرض ذلك tests/unit/stores-isolation.test.ts: لا قاعدة بيانات، ولا خادم، ولا أسرار، ولا ملفات متجر آخر.
// كل ما هنا عرضي أو مقيّد بالمتجر الحالي؛ أي إضافة يجب أن تحافظ على ذلك (لا مكوّن يقبل storeId).
export type {
  StoreKit,
  StoreData,
  KitProduct,
  KitCategory,
  KitReview,
  ProductSource,
  SectionType,
  SectionOf,
  SectionProps,
  BlockProps,
  SlotProps,
  HomeProps,
  PageProps,
  PageMeta,
} from "./types";
export type { Section, StoreBlueprint } from "@/blueprint/schema";
export type { StoreFact } from "@/blueprint/facts";

// عرض
export { SectionShell, SectionHeading } from "@/components/storefront/SectionShell";
export { Price } from "@/components/storefront/Price";
export { Reveal, RevealItem } from "@/components/storefront/Reveal";
export { ProductCard } from "@/components/storefront/ProductCard";
export { Icon } from "@/components/storefront/Icon";
export { Cta } from "@/components/blocks/_shared";

// حالة المتجر في المتصفح (مكوّنات "use client" فقط)
export { useStore, useCopy, useMotionLevel } from "@/components/storefront/StoreProvider";
export { useCart } from "@/store/cart";

// أدوات
export { formatEgp, savingsPercent } from "@/lib/money";
export { hrefFor } from "@/lib/links";
export { cn } from "@/lib/utils";
export { waLink } from "@/lib/whatsapp";
