// rules.ts — قرار حماية استمارة الطلب من الإساءة (منطق خالص مختبَر). العدّ في guard.ts.
// الطبقات بالترتيب: طلب مفتوح لنفس وسيلة التواصل ← حد البريد ← حد الرقم ← حد العنوان ← سقف يومي عام.

export type IntakeCounts = {
  /** طلبات مُرسلة ولم تُسلَّم بعد لنفس البريد أو رقم واتساب (من القاعدة). */
  openForContact: number;
  email7d: number;
  phone7d: number;
  ip24h: number;
  today: number;
};

export type IntakeLimits = { maxOpenPerContact: number; perEmail: number; perPhone: number; perIp: number; dailyCap: number };

export const DEFAULT_INTAKE_LIMITS: IntakeLimits = { maxOpenPerContact: 1, perEmail: 2, perPhone: 2, perIp: 10, dailyCap: 60 };
// perIp عالٍ عمداً: شبكات الموبايل المصرية تشارك عنواناً عاماً واحداً بين كثيرين (CGNAT) وزوار الإعلانات أغلبهم موبايل،
// فالحدّان الحقيقيان للإساءة هما البريد والرقم والطلب المفتوح. المالك يضبطه من إعداد «intake» في اللوحة.

export type IntakeBlock = "contact" | "email" | "phone" | "ip" | "daily";
export type IntakeDecision = { ok: true } | { ok: false; reason: IntakeBlock; message: string };

export const INTAKE_MESSAGES: Record<IntakeBlock, string> = {
  contact: "عندك طلب متجر مفتوح عندنا بالفعل. تابعه من رابط المتابعة اللي وصلك، ولو عايز تعدّل حاجة كلّمنا.",
  email: "وصلتنا طلبات كتير بنفس البريد. لو فيه حاجة محتاج تعدّلها كلّمنا مباشرة.",
  phone: "وصلتنا طلبات كتير بنفس الرقم. لو فيه حاجة محتاج تعدّلها كلّمنا مباشرة.",
  ip: "الشبكة اللي بتستخدمها وصلنا منها طلبات كتير النهارده (ممكن تكون شبكة مشتركة مع ناس تانيين). جرّب بعد شوية أو كلّمنا مباشرة.",
  daily: "استلمنا طلبات كتير النهارده وعايزين نديك وقتك كامل. جرّب بكرة أو كلّمنا مباشرة.",
};

export function decideIntake(c: IntakeCounts, l: IntakeLimits = DEFAULT_INTAKE_LIMITS): IntakeDecision {
  const block = (reason: IntakeBlock): IntakeDecision => ({ ok: false, reason, message: INTAKE_MESSAGES[reason] });
  if (c.openForContact >= l.maxOpenPerContact) return block("contact");
  if (c.email7d >= l.perEmail) return block("email");
  if (c.phone7d >= l.perPhone) return block("phone");
  if (c.ip24h >= l.perIp) return block("ip");
  if (c.today >= l.dailyCap) return block("daily");
  return { ok: true };
}

/** حدود من إعداد اللوحة (feature_flags «intake») مع رفض أي قيمة غير صالحة لصالح الافتراضي. */
export function limitsFrom(config: Record<string, unknown> | null | undefined): IntakeLimits {
  const n = (k: keyof IntakeLimits) => {
    const v = Number(config?.[k]);
    return Number.isInteger(v) && v > 0 && v <= 10_000 ? v : DEFAULT_INTAKE_LIMITS[k];
  };
  return { maxOpenPerContact: n("maxOpenPerContact"), perEmail: n("perEmail"), perPhone: n("perPhone"), perIp: n("perIp"), dailyCap: n("dailyCap") };
}
