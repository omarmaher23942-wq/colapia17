// nav.ts — خريطة صفحات لوحة التاجر: مصدر واحد للقائمة الجانبية ولوحة الأوامر (Ctrl/⌘+K) والشريط السفلي.
// البنية (V2): الرئيسية، الطلبات، المنتجات، العملاء، التسويق، المتجر، الإعدادات. كل رابط له مجال صلاحية في lib/store-perms.ts.
import {
  BarChart3,
  CircleHelp,
  ClipboardList,
  CreditCard,
  FileSpreadsheet,
  FolderTree,
  Gauge,
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
    title: "الرئيسية",
    items: [
      { label: "نظرة عامة", href: "/dashboard", icon: LayoutDashboard, exact: true, hint: "مهام اليوم وأداء المتجر وهدف الشهر", keywords: ["home", "الرئيسية", "ملخص", "هدف"] },
      { label: "التحليلات", href: "/dashboard/analytics", icon: BarChart3, hint: "المبيعات والزيارات ومراحل الشراء", keywords: ["analytics", "احصائيات", "تقارير"] },
      { label: "متجري", href: "/dashboard/store", icon: Store, hint: "رابط المتجر وحالته ورمز QR", keywords: ["store", "رابط", "qr"] },
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
    title: "المتجر",
    items: [
      { label: "شكل المتجر", href: "/dashboard/design", icon: Wand2, hint: "الألوان والخطوط والحركة وتعديل الشكل بالوصف", keywords: ["design", "ثيم", "الوان", "شكل"] },
      { label: "المحتوى والصفحات", href: "/dashboard/content", icon: Palette, hint: "نصوص وصور وأقسام الصفحة الرئيسية", keywords: ["content", "محتوى", "الصفحه الرئيسيه"] },
      { label: "السياسات والضمان", href: "/dashboard/policies", icon: ShieldCheck, hint: "الاستبدال والاسترجاع والمعاينة", keywords: ["policies", "ضمان", "سياسات"] },
      { label: "النطاق الخاص", href: "/dashboard/domain", icon: Globe, hint: "ربط نطاق مثل mystore.com", keywords: ["domain", "دومين", "نطاق"] },
    ],
  },
  {
    title: "الإعدادات",
    items: [
      { label: "الدفع والتواصل", href: "/dashboard/settings", icon: Settings, hint: "بيانات المتجر ووسائل الدفع والتواصل", keywords: ["settings", "اعدادات", "دفع", "واتساب"] },
      { label: "أسعار الشحن", href: "/dashboard/shipping", icon: Rocket, hint: "أسعار الشحن لكل محافظة", keywords: ["shipping", "توصيل", "محافظات"] },
      { label: "فريق المتجر", href: "/dashboard/team", icon: UserCog, hint: "دعوة موظفين بصلاحيات محددة", keywords: ["team", "موظفين", "صلاحيات"] },
      { label: "الاشتراك", href: "/dashboard/billing", icon: CreditCard, hint: "الباقة والتجديد والمدفوعات", keywords: ["billing", "فوترة", "اشتراك", "دفع", "تجديد"] },
      { label: "الاستخدام", href: "/dashboard/usage", icon: Gauge, hint: "حدود الاستخدام الشهرية والمتبقي منها", keywords: ["usage", "حدود", "استخدام", "حصة"] },
      { label: "طلب تعديل من الفريق", href: "/dashboard/requests", icon: MessageSquarePlus, hint: "اطلبوا من فريقنا تعديلاً في التصميم أو المحتوى", keywords: ["requests", "تعديل", "طلب"] },
    ],
  },
];

export const NAV_SECTIONS: NavSection[] = ALL;

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

/** القائمة لعضو فريق: ما يملك عرضه فقط (الخادم يحرس كل صفحة بنفسه؛ هذا إخفاء فقط). بلا perms = صاحب المتجر. */
export function navSectionsFor(perms?: StorePerms | null, _subdomain?: string | null): NavSection[] {
  if (!perms) return NAV_SECTIONS;
  return NAV_SECTIONS.map((s) => ({ ...s, items: s.items.filter((i) => allows(perms, areaForPath(i.href) ?? "analytics", "view")) })).filter((s) => s.items.length > 0);
}

export const navItemsFor = (perms?: StorePerms | null, subdomain?: string | null): NavItem[] => navSectionsFor(perms, subdomain).flatMap((s) => s.items);

/** الشريط السفلي على الموبايل: أكثر 4 صفحات استخداماً، والباقي في «المزيد». */
export const MOBILE_NAV_HREFS = ["/dashboard", "/dashboard/orders", "/dashboard/products", "/dashboard/orders/ship"] as const;

export function isNavActive(pathname: string, href: string, exact?: boolean): boolean {
  const path = href.split("?")[0]!;
  if (exact) return pathname === path;
  const own = NAV_ITEMS.find((i) => i.href === href);
  if (own?.notUnder?.some((n) => pathname === n || pathname.startsWith(`${n}/`))) return false;
  return pathname === path || pathname.startsWith(`${path}/`);
}
