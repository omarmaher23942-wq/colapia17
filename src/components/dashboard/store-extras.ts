// store-extras.ts — صفحات لوحة خاصة بمتجر واحد (لوحات التحكم المخصصة، stores/CLAUDE.md القسم 5 البند 7).
// كل إضافة مغلقة بنطاق المتجر الفرعي: متجر غير مذكور هنا لا يرى شيئاً ولا تتغير قائمته. الصفحة نفسها تتحقق من
// المتجر على الخادم (`hasStoreExtra`) فلا يكفي معرفة الرابط. المجال (`area`) يحدد من يراها من فريق المتجر.
import { ClipboardList, type LucideIcon } from "lucide-react";
import type { StoreArea } from "@/lib/store-perms";

export type StoreExtra = { key: string; label: string; href: string; icon: LucideIcon; area: StoreArea; hint: string; keywords?: string[] };

const EXTRAS: Record<string, StoreExtra[]> = {
  // نور للملابس (REQ-SLCVS): غرفة التجهيز (قائمة التجهيز وبطاقات التعبئة وطلب المقاسات).
  "nor-llmlabs": [
    {
      key: "prep",
      label: "غرفة التجهيز",
      href: "/dashboard/prep",
      icon: ClipboardList,
      area: "orders",
      hint: "قائمة تجهيز الطلبات وبطاقات التعبئة وأكثر المقاسات طلباً",
      keywords: ["prep", "تجهيز", "تعبئة", "مقاسات", "مورد", "picking"],
    },
  ],
};

export const storeExtras = (subdomain?: string | null): StoreExtra[] => (subdomain && Object.hasOwn(EXTRAS, subdomain) ? EXTRAS[subdomain]! : []);

export const hasStoreExtra = (subdomain: string | null | undefined, key: string): boolean => storeExtras(subdomain).some((e) => e.key === key);
