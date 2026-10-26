// status.ts — ما يراه العميل عن مشروعه (صفحة الشكر وبوابة العميل) مشتقاً من حالة الطلب والإنتاج. منطق خالص مختبَر.
// لا يكشف الحالات الداخلية (إسناد، مراجعة): العميل يرى أربع مراحل واضحة وصادقة.
export type ClientStatusKey = "awaiting_payment" | "confirmed" | "preparing" | "delivered" | "closed";

export type ClientStatus = {
  key: ClientStatusKey;
  /** رقم المرحلة من 1 إلى 4 (0 للمغلق). */
  step: number;
  label: string;
  detail: string;
};

export const PROJECT_STEPS = ["بانتظار تأكيد الدفع", "تم تأكيد الحجز", "قيد التجهيز", "تم التسليم"] as const;

type Row = { status: string; production: string };

export function clientStatus(r: Row): ClientStatus {
  if (r.status === "spam" || r.status === "withdrawn") {
    return { key: "closed", step: 0, label: "مغلق", detail: "أُغلق هذا الطلب. للاستفسار راسلونا من نفس البريد." };
  }
  if (r.status === "draft" || r.status === "awaiting_payment") {
    return {
      key: "awaiting_payment",
      step: 1,
      label: PROJECT_STEPS[0],
      detail: "استلمنا طلبكم وإيصال التحويل. نراجع التحويل ثم نؤكد الحجز بالبريد، وغالباً يتم ذلك خلال ساعات.",
    };
  }
  if (r.production === "delivered") {
    return { key: "delivered", step: 4, label: PROJECT_STEPS[3], detail: "سُلِّم مشروعكم. تجدون المستودع ورابط المتجر في صفحة «مشروعي» متى أضافهما الفريق." };
  }
  if (r.production === "new" || r.production === "assigned") {
    return { key: "confirmed", step: 2, label: PROJECT_STEPS[1], detail: "تم تأكيد الدفع وحجز مقعدكم. يبدأ الفريق تجهيز مشروعكم خلال 48 ساعة من التأكيد." };
  }
  return { key: "preparing", step: 3, label: PROJECT_STEPS[2], detail: "الفريق يجهّز مشروعكم الآن. سنراسلكم عند الجاهزية لنحدد معكم موعد الجلسة." };
}
