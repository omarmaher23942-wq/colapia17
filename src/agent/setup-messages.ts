// setup-messages.ts — نصوص رابط الإعداد والتذكيرات (خالصة). عربية فصحى مبسطة بالجمع، بلا ذكر لأدوات داخلية أو تقنية.

export type SetupMessage = { subject: string; text: string; buttonTitle: string };

export function setupLinkMessage(input: { storeName: string }): SetupMessage {
  return {
    subject: `متجر ${input.storeName} جاهز للإعداد`,
    text: [
      `أهلاً بكم. متجر «${input.storeName}» أصبح جاهزاً للإعداد.`,
      "افتحوا رابط الإعداد، واختاروا كلمة مرور للوحة التحكم، ثم أكملوا إعداداً سريعاً لا يسأل إلا عما ينقص متجركم.",
      "تبدأ معاينتكم المجانية (24 ساعة) من لحظة فتح الرابط ولا دفع قبل أن يعجبكم المتجر، وكل شيء قابل للتعديل لاحقاً من لوحة التحكم.",
    ].join("\n"),
    buttonTitle: "إعداد المتجر",
  };
}

export function setupReminderMessage(kind: "24h" | "72h", input: { storeName: string }): SetupMessage {
  if (kind === "24h") {
    return {
      subject: `متجر ${input.storeName} ينتظر إكمال الإعداد`,
      text: [`متجر «${input.storeName}» جاهز وينتظركم. الإعداد يستغرق نحو عشر دقائق ويُحفظ تقدمكم بعد كل خطوة، فيمكنكم الإكمال من حيث توقفتم.`, "اضغطوا الزر للمتابعة."].join("\n"),
      buttonTitle: "أكملوا الإعداد",
    };
  }
  return {
    subject: `تذكير أخير بإعداد متجر ${input.storeName}`,
    text: [`ما زال متجر «${input.storeName}» بانتظار إكمال إعداده. إن لم يكتمل خلال الأيام القادمة سنحذف المتجر غير المكتمل تلقائياً لنُفسح المجال لغيره، ويمكنكم دائماً أن تراسلونا لنبدأ من جديد.`, "نحتاج منكم عشر دقائق فقط."].join("\n"),
    buttonTitle: "أكملوا الإعداد",
  };
}

/** الحد الأدنى بين الإنشاء والتذكير بعد إرسال الرابط. */
export const REMINDER_OFFSETS_H = { "24h": 24, "72h": 72 } as const;

/** مواعيد مهام الإعداد من لحظة الإنشاء (خالص). تذكيرا 24 و72 ساعة يُحسبان من لحظة إرسال الرابط المتوقعة. */
export function setupSchedule(now: Date, opts: { delayMinutes: number; setupDays: number }) {
  const linkAt = new Date(now.getTime() + opts.delayMinutes * 60_000);
  const at = (h: number) => new Date(linkAt.getTime() + h * 3600_000);
  const purgeAt = new Date(now.getTime() + opts.setupDays * 86_400_000);
  // التذكير الأخير قبل الحذف بنصف يوم على الأقل: لو قصّرت مدة الإعداد نقدّم التذكيرات لتسبق الحذف.
  const latest = purgeAt.getTime() - 12 * 3600_000;
  const clamp = (d: Date) => new Date(Math.min(d.getTime(), Math.max(latest, linkAt.getTime() + 60_000)));
  return { link: linkAt, reminder24: clamp(at(REMINDER_OFFSETS_H["24h"])), reminder72: clamp(at(REMINDER_OFFSETS_H["72h"])), purge: purgeAt };
}
