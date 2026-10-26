// types.ts — أنواع مولّد مشروع العميل (خالصة، بلا تبعيات خادم).

/** ملفات المشروع: مسار نسبي بـ / ← نص أو بايتات. */
export type ProjectFiles = Record<string, string | Uint8Array>;

/** هوية العميل كما تُحقن في المشروع (من بيانات الطلب). لا أسرار هنا أبداً. */
export type DeliveryIdentity = {
  storeName: string;
  /** معرّف المتجر في المشروع (نطاق فرعي داخلي ثابت، لاتيني). لا يظهر للزوار. */
  slug: string;
  /** بريد صاحب المتجر: منه يدخل لوحته. */
  ownerEmail: string;
  niche?: string | null;
  instagram?: string | null;
  whatsapp?: string | null;
  /** تفضيل الألوان/الطابع (معرّف تصميم من blueprint/themes) إن حدده الفريق. */
  themeId?: string | null;
  /** قالب البدء (store-templates) إن حدده الفريق، وإلا يُشتق من النشاط. */
  templateId?: string | null;
  /** مجلد المتجر المخصص stores/<folder>/ (ناتج البناء) ليُضمَّن في المشروع؛ يُهمل إن لم يوجد. */
  storeFolder?: string | null;
  /** مرجع الطلب للفريق (يظهر في README فقط). */
  requestCode?: string | null;
  /** وقت التوليد (ISO). يُمرَّر للاختبارات لثبات المخرجات. */
  generatedAt?: string;
};

export type TemplateFile = { path: string; data: string | Uint8Array };
