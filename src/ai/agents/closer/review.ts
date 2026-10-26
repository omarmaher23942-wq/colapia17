// review.ts — مراجعة دور الوكيل قبل التنفيذ (خالصة ومختبَرة): حراسة المخرج + شروط الأفعال + منع التكرار الحرفي. النموذج وحده يقرر
// ماذا يقول ومتى يطلب فعلاً؛ الكود يتحقق فقط من شروط بيانية ورقمية (تغطية المجالات الخمسة، طلب لم يُنشأ سابقاً، ليست خدمة أخرى).
// الناتج ملاحظة صريحة تُلحق بالتعليمات في محاولة ثانية، لا رد بديل من الكود.
import { checkBuildRequest, type Area } from "@/agent/build-request";
import type { Lead } from "@/agent/lead";
import { replyProblem, type ReplyCtx } from "./guard";
import { AI_MAX_REPEAT_WINDOW } from "./policy";
import type { CloserTurn, TurnAction } from "./turn";

export type ActionCtx = {
  lead: Lead;
  /** مجالات رفضها العميل (المحفوظة سابقاً مع ما اقترحه هذا الدور). */
  declined: readonly Area[];
  /** المحادثة مصنفة «خدمة أخرى». */
  otherService: boolean;
  /** أُنشئ طلب بناء لهذه المحادثة سابقاً. */
  alreadyRequested: boolean;
};

export type ActionCheck = { ok: true } | { ok: false; reason: string };

/** شروط تنفيذ الفعل المطلوب. none/ignore/other_service بلا شروط. */
export function checkAction(action: TurnAction, c: ActionCtx): ActionCheck {
  if (action === "build_request") return checkBuildRequest(c);
  return { ok: true };
}

export type Review = { kind: "guard" | "action" | "repeat"; note: string };

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/** null = الدور سليم. وإلا نوع المشكلة وملاحظة للمحاولة الثانية. */
export function reviewTurn(turn: CloserTurn, i: { replyCtx: ReplyCtx; recentAssistant: string[]; action: ActionCtx }): Review | null {
  if (turn.action === "ignore") return null;
  const problem = replyProblem(turn.reply, i.replyCtx);
  if (problem) return { kind: "guard", note: problem };
  const check = checkAction(turn.action, i.action);
  if (!check.ok) return { kind: "action", note: `لا يمكن تنفيذ action = "${turn.action}" الآن: ${check.reason}. اجعل action = "none" وتابع الحوار بما يناسب (اسأل عما لم يُغطَّ بطبيعية) ولا تعد بإنشاء الطلب قبل ذلك.` };
  if (!turn.requestHuman && i.recentAssistant.slice(-AI_MAX_REPEAT_WINDOW).map(norm).includes(norm(turn.reply))) {
    return { kind: "repeat", note: "ردك السابق كان بنفس هذا النص حرفياً. أجب بما هو جديد ومفيد ولا تكرر." };
  }
  return null;
}
