// edition.ts — الفروق الصغيرة بين نسختي الكود نفسه:
//  - "platform": منصة Colapia (المتجر أثناء التجربة وحتى يستلمه التاجر).
//  - "store": مشروع التاجر الخاص (المتجر + لوحة التحكم فقط) على حساباته، يُولَّد من نفس المكونات.
// مولّد مشروع التاجر يستبدل هذا الملف بنسخته (template/src/lib/edition.ts)، فلا تُكتب
// أي شروط "إن كنا في نسخة التاجر" متفرقة في المكونات.
export const EDITION = "platform" as "platform" | "store";

/** صفحة الربط والمفاتيح: على المنصة "امتلك متجرك"، وفي مشروع التاجر مفاتيحه الخاصة. */
export const INTEGRATIONS_NAV = { label: "امتلك متجرك", href: "/dashboard/own" } as const;

/** وجهة التاجر الذي لا متجر له بعد. */
export const NO_STORE_HREF = "/dashboard/onboarding";

/** حسابات العملاء (دخول Google/رابط بالبريد) ميزة على المنصة؛ في مشروع التاجر يُتتبع الطلب بالكود. */
export const CUSTOMER_ACCOUNTS = true as boolean;

/** لاحقة عناوين صفحات اللوحة في تبويب المتصفح. */
export const DASHBOARD_TITLE_TEMPLATE = "%s · Colapia";

/** صفحات اللوحة الخاصة بالمنصة وحدها (الدفع للمنصة، تعدد المتاجر). */
export const PLATFORM_ONLY_NAV = ["/dashboard/billing", "/dashboard/store", "/dashboard/design"] as const;

/** دخول صاحب المتجر: في المنصة بـ Google (فلا كلمة مرور تُغيَّر)، وفي مشروع التاجر بالبريد وكلمة المرور. */
export const OWNER_LOGIN = "google" as "google" | "password";
