// order-spam.ts — حماية التاجر من الطلبات الوهمية المتكررة (أكبر خسارة لتاجر الدفع عند الاستلام: شحنات تُرفض).
// منطق خالص مختبَر: الأعداد من طلبات المتجر نفسه لنفس رقم الموبايل.
export const MAX_OPEN_ORDERS_PER_PHONE = 3; // طلبات «جديد/مؤكد» لم تُشحن بعد
export const MAX_ORDERS_PER_PHONE_DAY = 5; // كل الطلبات خلال 24 ساعة

export type PhoneOrderCounts = { open: number; lastDay: number };

/** null = مسموح، وإلا رسالة للعميل (مهذبة ولا تتهمه، وتوجهه للمتجر). */
export function phoneOrderBlock(c: PhoneOrderCounts): string | null {
  if (c.open >= MAX_OPEN_ORDERS_PER_PHONE)
    return "لديك طلبات سابقة لم تُشحن بعد على هذا الرقم. المتجر سيتواصل معك لتأكيدها، ويمكنك مراسلته لإضافة منتجات لطلبك.";
  if (c.lastDay >= MAX_ORDERS_PER_PHONE_DAY) return "وصلنا عدد كبير من الطلبات من هذا الرقم اليوم. للمزيد، يرجى التواصل مع المتجر مباشرة.";
  return null;
}
