// template-schema.ts — جداول قاعدة مشروع التاجر الخاص وحدها (مدخل drizzle-kit لتوليد template/drizzle).
// جداول المتجر + صفوف التاجر والمتجر والتصميم + الجلسات والسجلات والإعدادات. لا جداول منصة.
export {
  storeStatusEnum,
  orderStatusEnum,
  paymentMethodEnum,
  paymentStatusEnum,
  discountTypeEnum,
  productStatusEnum,
} from "../src/db/schema/enums";
export {
  supportThreadStatusEnum,
  supportSenderRoleEnum,
  supportCategoryEnum,
  supportPriorityEnum,
  supportSentimentEnum,
  supportThreads,
  supportMessages,
} from "../src/db/schema/support";
export { merchants, sessions } from "../src/db/schema/platform";
export { stores, storeBlueprints, storeSnapshots } from "../src/db/schema/stores";
export { categories, products, productVariants } from "../src/db/schema/catalog";
export { customers, shippingZones, discounts, orders, orderItems, payments, reviews, abandonedCarts } from "../src/db/schema/commerce";
export { analyticsEvents, analyticsDaily } from "../src/db/schema/analytics";
export { systemEvents } from "../src/db/schema/system";
export { aiCalls } from "../src/db/schema/ai";
export { marketingCampaigns } from "../src/db/schema/growth";
export { storeSettings } from "../template/src/db/schema/store-local";
