// types.ts — أنواع واجهة كود المتاجر الخاصة. كل ما يحصل عليه مكوّن في stores/<slug>/ يمر من هنا.
import type { ReactNode } from "react";
import type { Section, StoreBlueprint } from "@/blueprint/schema";
import type { StoreFact } from "@/blueprint/facts";
import type { ProductSource } from "@/blueprint/section-data";
import type { ProductCardProduct } from "@/components/storefront/ProductCard";

/** منتج كما تعرضه النواة؛ يُمرَّر مباشرة إلى ProductCard. */
export type KitProduct = ProductCardProduct;
export type KitCategory = { id: string; name: string; slug: string; productCount: number; image: string | null };
export type KitReview = { name: string; text: string; rating: number; verified: boolean };
export type { ProductSource };

/**
 * بيانات هذا المتجر فقط. لا تقبل أي دالة معرّف متجر: المتجر محدد على الخادم من النطاق قبل أن يصل الطلب لكودك،
 * فلا يوجد طريق لقراءة بيانات متجر آخر.
 */
export type StoreData = {
  /** منتجات منشورة من مصدر (featured | newest | best_sellers | on_sale | category | manual | tag)، حتى 24. */
  products(query?: { source?: ProductSource; limit?: number }): Promise<KitProduct[]>;
  /** منتج منشور واحد بتركيباته، أو null. */
  product(slug: string): Promise<KitProduct | null>;
  /** الأقسام الظاهرة بعدد منتجاتها وصورة غلاف (صورة القسم وإلا أول منتج). */
  categories(slugs?: string[]): Promise<KitCategory[]>;
  /** تقييمات المشترين المعتمدة بنص. */
  reviews(limit?: number): Promise<KitReview[]>;
};

export type StoreKit = {
  store: { id: string; name: string; subdomain: string };
  /** الـ Blueprint بعد حذف أي ادعاء لم يعد صحيحاً في سياسة المتجر (truthfulBlueprint). */
  bp: StoreBlueprint;
  /** حقائق المتجر الفعلية (الشحن، الدفع عند الاستلام، الاستبدال…). لا تكتب وعداً ليس هنا. */
  facts: StoreFact[];
  data: StoreData;
  /** يعرض أي قسم من أقسام النواة ببيانات هذا المتجر (للتركيب داخل مكوّن خاص). */
  section(s: Section): Promise<ReactNode>;
};

export type SectionType = Section["type"];
export type SectionOf<T extends SectionType> = Extract<Section, { type: T }>;

/** stores/<slug>/sections/<type>.tsx: يستبدل قسم النواة. `core` = ما كانت النواة ستعرضه (null إن لم يكن له بيانات). */
export type SectionProps<T extends SectionType = SectionType> = { s: SectionOf<T>; kit: StoreKit; core: ReactNode };

/** stores/<slug>/blocks/<name>.tsx: مكوّن جديد يوضع في الصفحة بقسم { type: "store_block", name }. */
export type BlockProps<P extends Record<string, unknown> = Record<string, unknown>> = { s: SectionOf<"store_block">; props: P; kit: StoreKit };

/** stores/<slug>/slots/Header.tsx | Footer.tsx: `core` = الهيدر/الفوتر الافتراضي (استخدمه أو استبدله). */
export type SlotProps = { kit: StoreKit; core: ReactNode };

/** stores/<slug>/slots/Home.tsx: ترتيب الصفحة الرئيسية بنفسك. `sections` أقسام الـ Blueprint معروضة بالترتيب. */
export type HomeProps = { kit: StoreKit; sections: { section: Section; node: ReactNode }[] };

/** stores/<slug>/pages/<name>.tsx: صفحة جديدة على /<name>. */
export type PageProps = { kit: StoreKit; path: string[]; searchParams: Record<string, string | string[] | undefined> };
/** تصدَّر من ملف الصفحة باسم `meta` (العنوان والوصف لمحركات البحث). */
export type PageMeta = { title: string; description?: string };
