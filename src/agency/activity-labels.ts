// activity-labels.ts — أسماء عربية لأحداث سجل نشاط الفريق (خالص). حدث مجهول يُعرض باسمه الخام لا يُخفى.
export const ACTIVITY_LABEL: Record<string, string> = {
  "member.added": "أضاف عضواً",
  "member.role": "غيّر دور عضو",
  "member.enabled": "فعّل عضواً",
  "member.disabled": "أوقف عضواً",
  "request.assign": "أسند طلباً",
  "request.production": "نقل حالة طلب",
  "request.provision": "جهّز مشروعاً",
  "request.deliver": "سلّم مشروعاً",
  "payment.confirm": "أكّد دفعة",
  "payment.reject": "رفض دفعة",
  "payment.revoke": "تراجع عن تأكيد دفعة",
  "pricing.update": "عدّل الأسعار",
  "flags.update": "عدّل إعداداً",
  "conversation.assign": "أسند محادثة",
  "conversation.note": "أضاف ملاحظة على محادثة",
  "conversation.followup": "حدّد موعد متابعة",
  "replies.update": "عدّل الردود المحفوظة",
  "backup.confirm": "أكّد نسخة احتياطية",
  "export.download": "نزّل ملف بيانات",
};

export const activityLabel = (action: string) => ACTIVITY_LABEL[action] ?? action;

const TARGET_KIND: Record<string, string> = { request: "طلب", member: "عضو", store: "متجر", conversation: "محادثة", payment: "دفعة" };

/** «طلب 3f2a91» من target بصيغة kind:id. */
export function describeTarget(target: string | null | undefined): string {
  if (!target) return "";
  const [kind, id = ""] = target.split(":");
  const k = TARGET_KIND[kind ?? ""];
  return k ? `${k} ${id.slice(0, 6)}` : target.slice(0, 40);
}
