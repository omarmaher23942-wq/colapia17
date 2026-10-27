// owner-mail.ts — نصوص إشعارات المالك من وكيل الرسائل (خالصة ومختبَرة): الإرسال الفعلي في closer/alerts.ts.

export type OwnerMail = { subject: string; headline: string; paragraphs: string[]; adminNote: string };

const channelName = (c: string) => (c === "instagram" ? "إنستجرام" : "ماسنجر");
const who = (name: string | null | undefined, ig?: string | null) => `${name?.trim() || "عميل"}${ig ? ` (@${ig})` : ""}`;
const oneLine = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);

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

/** عميل محتمل جديد ترك اسمه ورقمه: أُغلق الوكيل في المحادثة والكرة في ملعب الفريق. */
export function leadMail(i: { name: string; whatsapp: string; email?: string; service: string; summary: string; channel: string; igUsername?: string | null }): OwnerMail {
  const person = who(i.name, i.igUsername);
  return {
    subject: `عميل محتمل جديد: ${i.name}`,
    headline: "عميل محتمل ينتظر تواصلكم",
    paragraphs: [
      `${person} من ${channelName(i.channel)} ترك بياناته:`,
      [`الاسم: ${i.name}`, `واتساب: ${i.whatsapp}`, i.email && `البريد: ${i.email}`].filter(Boolean).join("\n"),
      i.service ? `الخدمة المطلوبة: ${oneLine(i.service, 300)}` : "",
      i.summary ? `ملخص المحادثة: ${oneLine(i.summary, 500)}` : "",
      "وُعد بأن يتواصل معه أحد الفريق في أسرع وقت. أُغلق الوكيل في هذه المحادثة. تجدونه في /admin/leads.",
    ].filter(Boolean),
    adminNote: `عميل محتمل جديد: ${person} · ${i.whatsapp}${i.service ? ` · ${oneLine(i.service, 100)}` : ""}`,
  };
}
