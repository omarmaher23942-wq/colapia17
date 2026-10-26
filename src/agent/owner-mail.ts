// owner-mail.ts — نصوص إشعارات المالك من وكيل الرسائل (خالصة ومختبَرة): الإرسال الفعلي في closer/alerts.ts.
import type { Lead } from "./lead";

export type OwnerMail = { subject: string; headline: string; paragraphs: string[]; adminNote: string };

const channelName = (c: string) => (c === "instagram" ? "إنستجرام" : "ماسنجر");
const who = (name: string | null | undefined, ig?: string | null) => `${name?.trim() || "عميل"}${ig ? ` (@${ig})` : ""}`;
const oneLine = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);

/** طلب خدمة غير المتجر: الوكيل أوقف نفسه بانتظار رد المالك. */
export function otherServiceMail(i: { name?: string | null; channel: string; igUsername?: string | null; brief: string; lead?: Lead }): OwnerMail {
  const person = who(i.name, i.lead?.instagram ?? i.igUsername);
  const contact = [i.lead?.email && `البريد: ${i.lead.email}`, i.lead?.whatsapp && `واتساب: ${i.lead.whatsapp}`].filter(Boolean).join(" · ");
  return {
    subject: `طلب مشروع غير متجر من ${person}`,
    headline: "عميل يطلب خدمة أخرى وينتظر ردكم",
    paragraphs: [
      `${person} على ${channelName(i.channel)} يطلب مشروعاً غير متجر إلكتروني.`,
      i.brief ? `ملخص الطلب: ${oneLine(i.brief, 500)}` : "لم يتضح من المحادثة ملخص محدد بعد؛ راجعوا الرسائل.",
      ...(contact ? [contact] : []),
      "لم يُطلب منه أي دفع ولم يُرسل له رابط الحجز. أوقفنا الوكيل في هذه المحادثة بانتظار ردكم، وهي معلّمة «خدمة أخرى» في قائمة المحادثات.",
    ],
    adminNote: `خدمة أخرى من ${person}: ${oneLine(i.brief || "راجعوا المحادثة", 160)}`,
  };
}

/** العميل طلب موظفاً أو رأى الوكيل أن الموقف يحتاج إنساناً. */
export function handoffMail(i: { name?: string | null; channel: string; reason: string; pauseHours: number }): OwnerMail {
  const person = who(i.name);
  return {
    subject: "عميل يطلب التحدث مع موظف",
    headline: "محادثة تنتظر موظفاً",
    paragraphs: [`${person} على ${channelName(i.channel)}: ${oneLine(i.reason, 200)}`, `أوقفنا الوكيل في هذه المحادثة لمدة ${i.pauseHours} ساعات ثم يعود وحده، أو استأنفوه فوراً من صفحة المحادثة.`],
    adminNote: `محادثة تحتاج موظفاً بشرياً (${channelName(i.channel)}): ${oneLine(i.reason, 160)}`,
  };
}

/** العميل فهم الخطوات بعد رابط الحجز: أُغلق الوكيل وصارت المحادثة للمالك. */
export function doneMail(i: { name?: string | null; channel: string; lead: Lead }): OwnerMail {
  const person = who(i.name, i.lead.instagram);
  const store = i.lead.storeName ?? "متجر جديد";
  const info = [i.lead.niche && `النشاط: ${i.lead.niche}`, `المتجر: ${store}`, i.lead.email && `البريد: ${i.lead.email}`, i.lead.whatsapp && `واتساب: ${i.lead.whatsapp}`].filter(Boolean).join(" · ");
  return {
    subject: `عميل استلم رابط الحجز: ${store}`,
    headline: "عميل فهم الخطوات والمحادثة الآن لكم",
    paragraphs: [
      `${person} على ${channelName(i.channel)} استلم رابط الحجز وأكد فهمه للخطوات.`,
      info,
      "أُغلق الوكيل في هذه المحادثة. حين يصل طلب الدفع راجعوه في صفحة المدفوعات وأكّدوه ليبدأ التجهيز.",
    ],
    adminNote: `${person} استلم رابط الحجز لـ«${store}» وأُغلق الوكيل: بانتظار الدفع وتأكيدكم.`,
  };
}
