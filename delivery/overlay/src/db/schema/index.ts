// نقطة تجميع مخطط قاعدة متجرك: جداول المتجر وحدها (بلا جداول منصة ولا وكالة).
export * from "./enums";
export * from "./platform";
export * from "./stores";
export * from "./catalog";
export { customers, shippingZones, discounts, orders, orderItems, payments, reviews, abandonedCarts, stockAlerts, returnRequests } from "./commerce";
export * from "./analytics";
export { marketingCampaigns } from "./growth";
// سجل أحداث النظام (يكتب فيه المسجِّل عند الأخطاء).
export { systemEvents } from "./system";
export type { SystemEventCategory, SystemEventLevel } from "./system";
// جداول خاصة بمشروعك: إعداداته ومفاتيحه.
export * from "./store-local";
