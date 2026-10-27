// review.ts — مراجعة دور الوكيل قبل التنفيذ (خالصة ومختبَرة): حراسة المخرج + شروط الأفعال + منع التكرار الحرفي. النموذج وحده يقرر
// ماذا يقول ومتى يطلب فعلاً؛ الكود يتحقق فقط من شروط بيانية ورقمية (تغطية المجالات الخمسة، طلب لم يُنشأ سابقاً، ليست خدمة أخرى).
// الناتج ملاحظة صريحة تُلحق بالتعليمات في محاولة ثانية، لا رد بديل من الكود.
import { validateEmail, validateWhatsapp } from "@/agent/lead";
import { replyProblem, toLatinDigits, type ReplyCtx } from "./guard";
import { AI_MAX_REPEAT_WINDOW } from "./policy";
import type { CloserTurn, TurnAction } from "./turn";

export type ActionCtx = {
  /** بيانات التواصل المقترحة من هذا الدور. */
  contact: CloserTurn["contact"];
  /** سُجّل عميل محتمل لهذه المحادثة سابقاً. */
  alreadyCaptured: boolean;
};

export type ActionCheck = { ok: true } | { ok: false; reason: string };

/** شروط الفعل: lead يلزمه اسم صالح ورقم واتساب مصري صالح، والبريد اختياري لكن إن كُتب فيجب أن يصح. */
export function checkAction(action: TurnAction, c: ActionCtx): ActionCheck {
  if (action !== "lead") return { ok: true };
  if (c.alreadyCaptured) return { ok: false, reason: "سُجّل هذا العميل من قبل" };
  const name = (c.contact.name ?? "").trim();
  if (name.length < 2) return { ok: false, reason: "الاسم غير مكتوب صراحة من العميل" };
  if (!validateWhatsapp(c.contact.whatsapp)) return { ok: false, reason: "رقم واتساب مصري صالح غير موجود" };
  if (c.contact.email && !validateEmail(c.contact.email)) return { ok: false, reason: "البريد المكتوب غير صالح (أسقطه أو اطلب تصحيحه)" };
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

const digitsOf = (s: string) => toLatinDigits(s).replace(/\D/g, "");

/** يُبقي من بيانات التواصل ما كتبه العميل فعلاً في رسائله (لا يُسجَّل اسم ولا رقم من تخمين النموذج). */
export function groundContact(c: CloserTurn["contact"], userTexts: string[]): CloserTurn["contact"] {
  const hay = userTexts.join("\n").toLowerCase();
  const hayDigits = digitsOf(hay);
  const name = c.name && c.name.toLowerCase().split(/\s+/).every((w) => hay.includes(w)) ? c.name : undefined;
  const phone = validateWhatsapp(c.whatsapp);
  const whatsapp = phone && hayDigits.includes(digitsOf(phone).slice(-10)) ? c.whatsapp : undefined;
  const email = c.email && hay.includes(c.email.toLowerCase().replace(/\s+/g, "")) ? c.email : undefined;
  return { name, whatsapp, email, service: c.service };
}
