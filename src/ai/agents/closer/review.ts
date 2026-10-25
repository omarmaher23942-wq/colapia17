// review.ts — مراجعة دور الوكيل قبل التنفيذ (خالصة ومختبَرة): حراسة المخرج + شروط الأفعال + منع التكرار الحرفي. النموذج وحده يقرر
// ماذا يقول ومتى يطلب فعلاً؛ الكود يتحقق فقط من شروط بيانية ورقمية (بريد صالح، مقاعد، فاصل زمني، رابط أُرسل قبل الإغلاق).
// الناتج ملاحظة صريحة تُلحق بالتعليمات في محاولة ثانية، لا رد بديل من الكود.
import { goldenGate, type Lead } from "@/agent/lead";
import { replyProblem, type ReplyCtx } from "./guard";
import { AI_MAX_REPEAT_WINDOW, MIN_LINK_GAP_MS } from "./policy";
import type { CloserTurn, TurnAction } from "./turn";

export type ActionCtx = {
  lead: Lead;
  /** المحادثة مصنفة «خدمة أخرى». */
  otherService: boolean;
  /** وقت آخر إرسال لرابط الحجز (ms) أو null. */
  linkSentAt: number | null;
  now: number;
};

export type ActionCheck = { ok: true } | { ok: false; reason: string };

const LABEL = { storeName: "اسم المتجر", email: "البريد الإلكتروني" } as const;

/** شروط تنفيذ الفعل المطلوب. none/ignore/other_service بلا شروط. */
export function checkAction(action: TurnAction, c: ActionCtx): ActionCheck {
  if (action === "golden_link") {
    if (c.otherService) return { ok: false, reason: "المحادثة مصنفة خدمة أخرى فلا يُرسل رابط حجز" };
    const gate = goldenGate(c.lead);
    if (!gate.ok) return { ok: false, reason: `ينقص ${gate.missing.map((k) => LABEL[k]).join(" و")} (يجب أن يكتبهما العميل صراحة)` };
    if (c.linkSentAt !== null && c.now - c.linkSentAt < MIN_LINK_GAP_MS) return { ok: false, reason: "رابط الحجز أُرسل قبل لحظات" };
  }
  if (action === "close_done") {
    if (c.otherService) return { ok: false, reason: "المحادثة مصنفة خدمة أخرى" };
    if (c.linkSentAt === null) return { ok: false, reason: "رابط الحجز لم يُرسل بعد" };
  }
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
  if (!check.ok) return { kind: "action", note: `لا يمكن تنفيذ action = "${turn.action}" الآن: ${check.reason}. اجعل action = "none" وتابع الحوار بما يناسب ولا تعد بإرسال رابط.` };
  if (!turn.requestHuman && i.recentAssistant.slice(-AI_MAX_REPEAT_WINDOW).map(norm).includes(norm(turn.reply))) {
    return { kind: "repeat", note: "ردك السابق كان بنفس هذا النص حرفياً. أجب بما هو جديد ومفيد ولا تكرر." };
  }
  return null;
}
