// nav.ts — خريطة صفحات لوحة التاجر: مصدر واحد للقائمة الجانبية ولوحة الأوامر (Ctrl/⌘+K).
// الصفحات الخاصة بالمنصة (PLATFORM_ONLY_NAV) تُستبعد تلقائياً في مشروع التاجر.
import { BarChart3, CreditCard, FolderTree, Ruler, LayoutDashboard, Package, Palette, Settings, ShieldCheck, ShoppingCart, Star, Store, TicketPercent, Truck, Users, Wand2, UserCog, Globe, FileArchive, MessageSquarePlus, Megaphone, type LucideIcon } from "lucide-react";
import { EDITION, PLATFORM_ONLY_NAV } from "@/lib/edition";
import { allows, areaForPath, type StorePerms } from "@/lib/store-perms";
import { storeExtras } from "./store-extras";

export type BadgeKey = "orders" | "reviews" | "products";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
  badgeKey?: BadgeKey;
  /** وصف قصير وكلمات بحث للوحة الأوامر. */
  hint: string;
  keywords?: string[];
};

export type NavSection = { title: string; items: NavItem[] };

const ALL: NavSection[] = [
  {
    title: "الرئيسية",
    items: [
      { label: "نظرة عامة", href: "/dashboard", icon: LayoutDashboard, exact: true, hint: "ملخص آخر 30 يوماً", keywords: ["home", "الرئيسية", "ملخص"] },
      { label: "متجري", href: "/dashboard/store", icon: Store, hint: "رابط متجرك وحالته ورمز QR", keywords: ["store", "رابط", "qr"] },
      { label: "التحليلات", href: "/dashboard/analytics", icon: BarChart3, hint: "المبيعات والزيارات ومراحل الشراء", keywords: ["analytics", "احصائيات", "تقارير"] },
    ],
  },
  {
    title: "المبيعات",
    items: [
      { label: "الطلبات", href: "/dashboard/orders", icon: ShoppingCart, badgeKey: "orders", hint: "تأكيد الطلبات وتجهيزها وشحنها", keywords: ["orders", "اوردر", "اوردرات"] },
      { label: "العملاء", href: "/dashboard/customers", icon: Users, hint: "من اشترى منك وكم أنفق", keywords: ["customers", "زباين", "زبائن"] },
      { label: "التقييمات", href: "/dashboard/reviews", icon: Star, badgeKey: "reviews", hint: "اعتماد آراء العملاء", keywords: ["reviews", "مراجعات", "اراء"] },
    ],
  },
  {
    title: "الكتالوج",
    items: [
      { label: "المنتجات", href: "/dashboard/products", icon: Package, badgeKey: "products", hint: "المنتجات والأسعار والمخزون", keywords: ["products", "مخزون", "اصناف"] },
      { label: "الأقسام", href: "/dashboard/categories", icon: FolderTree, hint: "أقسام المتجر وترتيبها", keywords: ["categories", "فئات", "تصنيفات"] },
      { label: "دليل المقاسات", href: "/dashboard/size-guide", icon: Ruler, hint: "جدول المقاسات ومساعد اختيار المقاس", keywords: ["size", "مقاس", "مقاسات", "قياس"] },
      { label: "أكواد الخصم", href: "/dashboard/discounts", icon: TicketPercent, hint: "كوبونات وعروض", keywords: ["discounts", "كوبون", "خصم", "عروض"] },
      { label: "التسويق", href: "/dashboard/marketing", icon: Megaphone, hint: "بكسل الإعلانات وكتالوج المنتجات", keywords: ["marketing", "pixel", "بكسل", "اعلانات", "كتالوج", "فيسبوك", "تيك توك"] },
      { label: "الشحن", href: "/dashboard/shipping", icon: Truck, hint: "أسعار الشحن لكل محافظة", keywords: ["shipping", "توصيل", "محافظات"] },
      { label: "السياسات والضمان", href: "/dashboard/policies", icon: ShieldCheck, hint: "الاستبدال والاسترجاع والمعاينة", keywords: ["policies", "استرجاع", "استبدال", "ضمان"] },
    ],
  },
  {
    title: "التصميم",
    items: [
      { label: "تصميم المتجر", href: "/dashboard/design", icon: Wand2, hint: "هوية المتجر ومستوى الحركة", keywords: ["design", "ثيم", "الوان"] },
      { label: "محرر المحتوى", href: "/dashboard/content", icon: Palette, hint: "نصوص وصور وأقسام الصفحة الرئيسية", keywords: ["content", "محتوى", "الصفحه الرئيسيه"] },
    ],
  },
  {
    title: "الحساب",
    items: [
      { label: "الإعدادات", href: "/dashboard/settings", icon: Settings, hint: "بيانات المتجر والتواصل والدفع", keywords: ["settings", "اعدادات"] },
      { label: "اطلب تعديل", href: "/dashboard/requests", icon: MessageSquarePlus, hint: "اطلب من فريقنا تعديلاً في التصميم أو المحتوى", keywords: ["requests", "تعديل", "طلب", "تصميم"] },
      { label: "نطاقك الخاص", href: "/dashboard/domain", icon: Globe, hint: "اربط نطاقاً مثل mystore.com", keywords: ["domain", "دومين", "نطاق"] },
      { label: "نسخة من الكود", href: "/dashboard/own", icon: FileArchive, hint: "اطلب نسخة كاملة من كود متجرك وبياناته", keywords: ["code", "كود", "نسخة", "تسليم"] },
      { label: "فريق المتجر", href: "/dashboard/team", icon: UserCog, hint: "ادعُ موظفين بصلاحيات محددة", keywords: ["team", "موظفين", "صلاحيات", "فريق"] },
      { label: "الدفع والتفعيل", href: "/dashboard/billing", icon: CreditCard, hint: "ادفع مرة واحدة وفعّل متجرك", keywords: ["billing", "فوترة", "اشتراك", "دفع"] },
    ],
  },
];

export const NAV_SECTIONS: NavSection[] = ALL.map((s) => ({
  ...s,
  items: s.items.filter((i) => EDITION === "platform" || !(PLATFORM_ONLY_NAV as readonly string[]).includes(i.href)),
})).filter((s) => s.items.length > 0);

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

/** القائمة لعضو فريق: ما يملك عرضه فقط (الخادم يحرس كل صفحة بنفسه؛ هذا إخفاء فقط). بلا perms = صاحب المتجر. */
export function navSectionsFor(perms?: StorePerms | null, subdomain?: string | null): NavSection[] {
  const base = perms
    ? NAV_SECTIONS.map((s) => ({ ...s, items: s.items.filter((i) => allows(perms, areaForPath(i.href) ?? "analytics", "view")) })).filter((s) => s.items.length > 0)
    : NAV_SECTIONS;
  // صفحات اللوحة الخاصة بهذا المتجر وحده (store-extras.ts)؛ أي متجر آخر لا تتغير قائمته.
  const extras = storeExtras(subdomain).filter((e) => !perms || allows(perms, e.area, "view"));
  if (!extras.length) return base;
  const items: NavItem[] = extras.map(({ label, href, icon, hint, keywords }) => ({ label, href, icon, hint, keywords }));
  return [base[0]!, { title: "خاص بمتجرك", items }, ...base.slice(1)];
}

export const navItemsFor = (perms?: StorePerms | null, subdomain?: string | null): NavItem[] => navSectionsFor(perms, subdomain).flatMap((s) => s.items);

/** الشريط السفلي على الموبايل: أكثر 4 صفحات استخداماً، والباقي في «المزيد». */
export const MOBILE_NAV_HREFS = ["/dashboard", "/dashboard/orders", "/dashboard/products", "/dashboard/analytics"] as const;

export function isNavActive(pathname: string, href: string, exact?: boolean): boolean {
  const path = href.split("?")[0]!;
  if (exact) return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
}
