// email-safe.ts — تنظيف حقول الرسائل القادمة من مدخلات المستخدمين (خالص ومختبَر): لا أسطر جديدة في العنوان ولا في عنوان الرد.
export const cleanSubject = (s: string, max = 150) =>
  String(s ?? "")
    .replace(/[\r\n\u2028\u2029\u0000]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, max);

/** عنوان رد صالح بلا فواصل أو أسطر (يمنع حقن عناوين إضافية)، أو undefined. */
export function cleanReplyTo(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const t = v.trim();
  return /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/.test(t) && t.length <= 254 ? t : undefined;
}
