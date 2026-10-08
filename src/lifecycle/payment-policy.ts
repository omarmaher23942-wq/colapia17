// payment-policy.ts — تقييم إيصال الدفع لمساعدة المالك في المراجعة (قرار المالك: لا قبول آلي؛ كل إيصال يراجعه بنفسه).
//
// الفحص الآلي لا يقبل ولا يرفض: يكتب للمالك خلاصة واضحة (مطابق / يحتاج انتباهاً / إشارة احتيال) تظهر
// في بريد التنبيه وفي صفحة المدفوعات، والقرار للمالك وحده.
export type Verification = {
  amountEgp: number | null;
  looksEdited: boolean;
  confidence: number;
  recommendation: "approve" | "review" | "reject";
  reason: string;
  duplicate?: boolean;
};

export type ReceiptAssessment = { level: "ok" | "check" | "danger"; summary: string };

export function assessReceipt(v: Verification | null, expectedEgp: number): ReceiptAssessment {
  if (!v) return { level: "check", summary: "تعذّر الفحص الآلي؛ راجع الصورة بنفسك." };
  if (v.duplicate) return { level: "danger", summary: "نفس صورة الإيصال استُخدمت في تحويل سابق." };
  if (v.looksEdited && v.confidence >= 0.8) return { level: "danger", summary: "صورة الإيصال تبدو معدّلة." };
  if (v.amountEgp !== null && v.amountEgp < expectedEgp - 1 && v.confidence >= 0.7)
    return { level: "danger", summary: `المبلغ في الإيصال (${v.amountEgp} ج) أقل من المطلوب (${expectedEgp} ج).` };
  if (v.recommendation === "approve" && v.confidence >= 0.7) return { level: "ok", summary: v.reason || "الإيصال يبدو مطابقاً." };
  return { level: "check", summary: v.reason || "الفحص غير قاطع؛ راجع الصورة." };
}
