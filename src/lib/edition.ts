// edition.ts — ثوابت صغيرة مشتركة بين صفحات اللوحة والمتجر. نسخة واحدة فقط: منصة Colapia
// (الاستضافة علينا دائماً؛ لا مشروع مستقل للتاجر).

/** وجهة التاجر الذي لا متجر له بعد. */
export const NO_STORE_HREF = "/start";

/** حسابات العملاء (دخول Google/رابط بالبريد) في المتجر. */
export const CUSTOMER_ACCOUNTS = true as boolean;

/** لاحقة عناوين صفحات اللوحة في تبويب المتصفح. */
export const DASHBOARD_TITLE_TEMPLATE = "%s · Colapia";
