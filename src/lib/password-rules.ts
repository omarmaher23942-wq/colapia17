// password-rules.ts — قواعد كلمة مرور صاحب المتجر ومقياس قوتها (خالص ومختبَر). الرسائل عربية بصيغة الجمع.
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

const COMMON = ["password", "12345678", "123456789", "1234567890", "qwerty123", "11111111", "00000000", "iloveyou", "admin123", "colapia"];

const hasLetter = (s: string) => /[A-Za-z؀-ۿ]/.test(s);
const hasDigit = (s: string) => /[0-9٠-٩]/.test(s);

/** أسباب الرفض (فارغة = مقبولة). ctx.email يمنع أن تتضمن كلمة المرور الجزء المحلي من البريد. */
export function passwordIssues(pw: string, ctx: { email?: string | null } = {}): string[] {
  const out: string[] = [];
  if (pw.length < PASSWORD_MIN) out.push(`${PASSWORD_MIN} أحرف على الأقل.`);
  if (pw.length > PASSWORD_MAX) out.push(`${PASSWORD_MAX} حرفاً على الأكثر.`);
  if (pw.length >= 1 && !(hasLetter(pw) && hasDigit(pw))) out.push("تحتوي حرفاً ورقماً على الأقل.");
  const low = pw.toLowerCase();
  const local = (ctx.email ?? "").toLowerCase().split("@")[0] ?? "";
  if (COMMON.some((c) => low.includes(c)) || /^(.)\1+$/.test(pw)) out.push("لا تكون كلمة شائعة أو سهلة التخمين.");
  else if (local.length >= 4 && low.includes(local)) out.push("لا تتضمن اسم بريدكم الإلكتروني.");
  return out;
}

export type Strength = { score: 0 | 1 | 2 | 3 | 4; label: string };

/** قوة كلمة المرور للعرض فقط (لا تغني عن passwordIssues). */
export function passwordStrength(pw: string): Strength {
  if (!pw) return { score: 0, label: "" };
  let s = 0;
  if (pw.length >= PASSWORD_MIN) s++;
  if (pw.length >= 14) s++;
  if (/[a-z؀-ۿ]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (hasDigit(pw) && /[^A-Za-z0-9؀-ۿ]/.test(pw)) s++;
  if (passwordIssues(pw).length) s = Math.min(s, 1);
  const score = Math.min(4, s) as Strength["score"];
  return { score, label: ["ضعيفة", "ضعيفة", "مقبولة", "جيدة", "قوية"][score]! };
}
