import {
  Shirt,
  Sparkles,
  Smartphone,
  UtensilsCrossed,
  Home,
  Baby,
  Gem,
  Gift,
  HeartPulse,
  Package,
  type LucideIcon,
} from "lucide-react";
import { INDUSTRY_IDS } from "@/onboarding/schema";

export type IndustryId = (typeof INDUSTRY_IDS)[number];

export const INDUSTRY_LABELS: Record<IndustryId, string> = {
  fashion: "ملابس وأزياء",
  beauty: "جمال ومستحضرات عناية",
  electronics: "إلكترونيات وموبايلات",
  food: "أغذية ومشروبات",
  home: "أدوات منزلية وديكور",
  kids: "أطفال ومستلزمات مواليد",
  accessories: "إكسسوارات وساعات",
  gifts: "هدايا وتوزيعات",
  health: "صحة ومكملات",
  other: "نشاط تجاري آخر",
};

export const INDUSTRY_HINTS: Record<IndustryId, string> = {
  fashion: "قمصان، فساتين، بناطيل",
  beauty: "مكياج، سكين كير، عطور",
  electronics: "سماعات، شواحن، إكسسوارات",
  food: "حلويات، عسل، توابل",
  home: "مطبخ، غرف نوم، ديكور",
  kids: "ملابس، ألعاب، عربيات",
  accessories: "شنط، محافظ، ساعات",
  gifts: "مناسبات، توزيعات",
  health: "فيتامينات، أعشاب",
  other: "أي نشاط آخر",
};

export const INDUSTRY_ICONS: Record<IndustryId, LucideIcon> = {
  fashion: Shirt,
  beauty: Sparkles,
  electronics: Smartphone,
  food: UtensilsCrossed,
  home: Home,
  kids: Baby,
  accessories: Gem,
  gifts: Gift,
  health: HeartPulse,
  other: Package,
};

/** يُستخدم في ProgressIndicator و StepShell */
export const STEP_TITLES = {
  store: "بيانات متجرك",
  audience: "الجمهور والمنافسين",
  products: "منتجاتك",
  launch: "الشحن والدفع والهوية",
  review: "المراجعة النهائية",
} as const;

/** يُستخدم في StepShell لعرض وصف مختصر */
export const STEP_DESCRIPTIONS = {
  store:
    "اسم متجرك، نشاطك، طرق التواصل معك، والرابط المخصص الذي سيشاركه عملاؤك.",
  audience:
    "حدّد الشريحة المستهدفة بدقة، وأضف منافسيك الأساسيين، واكتب ميزتك التنافسية التي تميزك عنهم.",
  products:
    "أضف منتجاتك بصورها وأسعارها، وسيتولى الذكاء الاصطناعي كتابة الأوصاف التسويقية.",
  launch: "أسعار التوصيل، طرق استلام أرباحك، وهوية ألوان متجرك.",
  review: "راجع تفاصيل متجرك ومنتجاتك وطرق الشحن والدفع قبل إطلاق المتجر.",
} as const;

/** Smart defaults per industry */
export const INDUSTRY_SMART_DEFAULTS: Record<
  IndustryId,
  { shippingHint?: string; taglineSuggestion?: string }
> = {
  fashion: { taglineSuggestion: "أزياء تواكب ذوقك" },
  beauty: { taglineSuggestion: "جمالك يبدأ من هنا" },
  electronics: { shippingHint: "شحن مؤمّن لكل المحافظات" },
  food: { shippingHint: "تغليف يحفظ الجودة" },
  home: { taglineSuggestion: "لمسة فنية لبيتك" },
  kids: { taglineSuggestion: "كل ما يحتاجه صغيرك" },
  accessories: { taglineSuggestion: "تفاصيل تكمّل إطلالتك" },
  gifts: { taglineSuggestion: "هدايا تُسعد من تحب" },
  health: { taglineSuggestion: "صحتك أولويتنا" },
  other: {},
};