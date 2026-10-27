// nav.ts — خريطة صفحات لوحة التاجر: مصدر واحد للقائمة الجانبية ولوحة الأوامر (Ctrl/⌘+K) والشريط السفلي.
// البنية (V3): اليوم، الطلبات، المنتجات، العملاء، التسويق، المتجر وشكله، الإعدادات والاشتراك. كل رابط له مجال صلاحية في lib/store-perms.ts.
import {
  Archive,
  BarChart3,
  Boxes,
  TrendingUp,
  CircleHelp,
  ClipboardList,
  CreditCard,
  DatabaseZap,
  FileSpreadsheet,
  FolderTree,
  Globe,
  LayoutDashboard,
  Megaphone,
  MessageSquarePlus,
  Package,
  PackageOpen,
  Palette,
  PenLine,
  Rocket,
  Ruler,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  TicketPercent,
  Truck,
  Upload,
  UserCog,
  Users,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { allows, areaForPath, type StorePerms } from "@/lib/store-perms";

export type BadgeKey = "orders" | "reviews" | "products" | "returns" | "questions";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
  /** مسارات فرعية لها بند خاص في القائمة فلا يُعلَّم هذا البند نشطاً داخلها. */
  notUnder?: string[];
  badgeKey?: BadgeKey;
  /** وصف قصير وكلمات بحث للوحة الأوامر. */
  hint: string;
  keywords?: string[];
};

export type NavSection = { title: string; items: NavItem[] };

const ALL: NavSection[] = [
  {
    title: "اليوم",
    items: [
      { label: "اليوم", href: "/dashboard", icon: LayoutDashboard, exact: true, hint: "مهام اليوم وأداء المتجر وهدف الشهر", keywords: ["home", "الرئيسية", "نظرة عامة", "ملخص", "هدف", "اليوم"] },
      { label: "التحليلات", href: "/dashboard/analytics", icon: BarChart3, notUnder: ["/dashboard/analytics/products", "/dashboard/analytics/inventory"], hint: "المبيعات والزيارات ومراحل الشراء", keywords: ["analytics", "احصائيات", "تقارير"] },
      { label: "تقرير المنتجات", href: "/dashboard/analytics/products", icon: TrendingUp, hint: "ربحية كل منتج والمبيعات بحسب القسم والقناة والعملاء العائدون", keywords: ["ربح", "هامش", "profit", "تقرير", "قنوات", "اقسام"] },
      { label: "تقرير المخزون", href: "/dashboard/analytics/inventory", icon: Boxes, hint: "قيمة المخزون وأيام التغطية والمنتجات الراكدة", keywords: ["مخزون", "راكد", "inventory", "قيمة", "تغطية"] },
      { label: "رابط متجري", href: "/dashboard/store", icon: Store, hint: "رابط المتجر وحالته ورمز QR وخطوات وضعه في البايو ورسائل جاهزة للعملاء", keywords: ["store", "رابط", "qr", "بايو", "bio", "رسائل", "متجري"] },
    ],
  },
  {
    title: "الطلبات",
    items: [
      { label: "كل الطلبات", href: "/dashboard/orders", icon: ShoppingCart, notUnder: ["/dashboard/orders/prep", "/dashboard/orders/ship", "/dashboard/orders/new"], badgeKey: "orders", hint: "تأكيد الطلبات وتجهيزها وشحنها", keywords: ["orders", "اوردر", "طلبات"] },
      { label: "التجهيز", href: "/dashboard/orders/prep", icon: ClipboardList, hint: "قائمة التجهيز وبطاقات التعبئة وطلب المقاسات", keywords: ["prep", "تجهيز", "تعبئة", "picking"] },
      { label: "الشحن", href: "/dashboard/orders/ship", icon: Truck, hint: "تصدير للشركات وملصقات الشحن وتسوية التحصيل", keywords: ["ship", "شحن", "بوسطة", "ارامكس", "مايلرز", "تحصيل", "awb"] },
      { label: "الاستبدال والاسترجاع", href: "/dashboard/returns", icon: PackageOpen, badgeKey: "returns", hint: "طلبات الاستبدال والاسترجاع والإلغاء", keywords: ["returns", "مرتجع", "استرجاع", "استبدال", "الغاء"] },
      { label: "طلب من الشات", href: "/dashboard/orders/new", icon: PenLine, hint: "تسجيل طلب جاء عبر إنستجرام أو واتساب", keywords: ["chat", "يدوي", "واتساب", "انستجرام"] },
    ],
  },
  {
    title: "المنتجات",
    items: [
      { label: "كل المنتجات", href: "/dashboard/products", icon: Package, notUnder: ["/dashboard/products/bulk", "/dashboard/products/import"], badgeKey: "products", hint: "المنتجات والأسعار والمخزون", keywords: ["products", "مخزون", "اصناف"] },
      { label: "الأقسام", href: "/dashboard/categories", icon: FolderTree, hint: "أقسام المتجر وترتيبها", keywords: ["categories", "فئات", "تصنيفات"] },
      { label: "تعديل جماعي", href: "/dashboard/products/bulk", icon: FileSpreadsheet, hint: "تعديل الأسعار والمخزون والحالة من جدول واحد", keywords: ["bulk", "جماعي", "اسعار", "جدول"] },
      { label: "استيراد المنتجات", href: "/dashboard/products/import", icon: Upload, hint: "إضافة منتجات من صور أو ملف", keywords: ["import", "استيراد", "csv", "اكسل"] },
      { label: "دليل المقاسات", href: "/dashboard/size-guide", icon: Ruler, hint: "جدول المقاسات ومساعد اختيار المقاس", keywords: ["size", "مقاس", "مقاسات"] },
      { label: "التقييمات", href: "/dashboard/reviews", icon: Star, badgeKey: "reviews", hint: "اعتماد آراء العملاء", keywords: ["reviews", "مراجعات", "اراء"] },
      { label: "الأسئلة", href: "/dashboard/questions", icon: CircleHelp, badgeKey: "questions", hint: "أسئلة الزوار عن المنتجات وإجاباتكم", keywords: ["questions", "اسئلة", "استفسار"] },
    ],
  },
  {
    title: "العملاء",
    items: [{ label: "العملاء", href: "/dashboard/customers", icon: Users, hint: "من اشترى وكم أنفق، ووسوم وقوائم واتساب", keywords: ["customers", "زبائن", "عملاء"] }],
  },
  {
    title: "التسويق",
    items: [
      { label: "أكواد الخصم", href: "/dashboard/discounts", icon: TicketPercent, hint: "كوبونات وخصومات تلقائية", keywords: ["discounts", "كوبون", "خصم", "عروض"] },
      { label: "الحملات والتتبع", href: "/dashboard/marketing", icon: Megaphone, hint: "روابط الحملات وبكسل الإعلانات والكتالوج وعُدّة الإطلاق", keywords: ["marketing", "pixel", "بكسل", "اعلانات", "حملات", "عدة الاطلاق", "launch"] },
      { label: "استوديو المحتوى", href: "/dashboard/studio", icon: Sparkles, hint: "تعليقات وستوري وتقويم أسبوعي من منتجاتكم", keywords: ["studio", "محتوى", "كابشن", "ستوري", "تقويم"] },
    ],
  },
  {
    title: "المتجر وشكله",
    items: [
      { label: "شكل المتجر", href: "/dashboard/design", icon: Wand2, hint: "الألوان والخطوط والحركة وتعديل الشكل بالوصف", keywords: ["design", "ثيم", "الوان", "شكل"] },
      { label: "المحتوى والصفحات", href: "/dashboard/content", icon: Palette, hint: "نصوص وصور وأقسام الصفحة الرئيسية", keywords: ["content", "محتوى", "الصفحه الرئيسيه"] },
      { label: "السياسات والضمان", href: "/dashboard/policies", icon: ShieldCheck, hint: "الاستبدال والاسترجاع والمعاينة", keywords: ["policies", "ضمان", "سياسات"] },
    ],
  },
  {
    title: "الإعدادات والاشتراك",
    items: [
      { label: "إعدادات المتجر", href: "/dashboard/settings", icon: Settings, hint: "بيانات المتجر ووسائل الدفع والتواصل", keywords: ["settings", "اعدادات", "دفع", "واتساب"] },
      { label: "النسخ الاحتياطي والتصدير", href: "/dashboard/settings/data", icon: Archive, hint: "نسخة كاملة من بيانات المتجر وتصدير Excel", keywords: ["backup", "نسخة", "احتياطي", "تصدير", "export", "بيانات"] },
      { label: "أسعار الشحن", href: "/dashboard/shipping", icon: Rocket, hint: "أسعار الشحن لكل محافظة", keywords: ["shipping", "توصيل", "محافظات"] },
      { label: "فريق المتجر", href: "/dashboard/team", icon: UserCog, hint: "دعوة موظفين بصلاحيات محددة", keywords: ["team", "موظفين", "صلاحيات"] },
    ],
  },
];

export const NAV_SECTIONS: NavSection[] = ALL;

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

/** الصفحات المفتوحة أثناء قفل اللوحة (مجمّد/متوقف): الاشتراك وحده (وملحقه الاستخدام). */
export const LOCKED_OPEN_HREFS = [] as const;

/**
 * القائمة لعضو فريق: ما يملك عرضه فقط (الخادم يحرس كل صفحة بنفسه؛ هذا إخفاء فقط). بلا perms = صاحب المتجر.
 * أثناء القفل لا يبقى إلا الاشتراك (تسجيل الخروج منفصل في القائمة).
 */
export function navSectionsFor(perms?: StorePerms | null, _subdomain?: string | null, locked?: boolean): NavSection[] {
  const base = locked ? NAV_SECTIONS.map((s) => ({ ...s, items: s.items.filter((i) => (LOCKED_OPEN_HREFS as readonly string[]).includes(i.href)) })) : NAV_SECTIONS;
  if (!perms) return base.filter((s) => s.items.length > 0);
  return base.map((s) => ({ ...s, items: s.items.filter((i) => allows(perms, areaForPath(i.href) ?? "analytics", "view")) })).filter((s) => s.items.length > 0);
}

export const navItemsFor = (perms?: StorePerms | null, subdomain?: string | null, locked?: boolean): NavItem[] => navSectionsFor(perms, subdomain, locked).flatMap((s) => s.items);

/** الشريط السفلي على الموبايل: أكثر 4 صفحات استخداماً، والباقي في «المزيد». */
export const MOBILE_NAV_HREFS = ["/dashboard", "/dashboard/orders", "/dashboard/products", "/dashboard/customers"] as const;

export function isNavActive(pathname: string, href: string, exact?: boolean): boolean {
  const path = href.split("?")[0]!;
  if (exact) return pathname === path;
  const own = NAV_ITEMS.find((i) => i.href === href);
  if (own?.notUnder?.some((n) => pathname === n || pathname.startsWith(`${n}/`))) return false;
  return pathname === path || pathname.startsWith(`${path}/`);
}
