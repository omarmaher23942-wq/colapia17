// production.ts — حالات الإنتاج الداخلية لطلب المتجر (يراها الفريق فقط) وقواعد الانتقال بينها وقائمة فحص الجودة
// قبل التسليم. منطق خالص مختبَر.
//
// العميل يرى خمس مراحل بسيطة (intake/stages.ts). الفريق يعمل بحالات أدق، وكل تقدم في الإنتاج يدفع مرحلة العميل
// للأمام (لا للخلف) تلقائياً، فلا يتأخر ما يراه العميل عن الواقع ولا يسبقه.
import { PRODUCTION_STATES, type ProductionStateValue, type RequestStage } from "@/intake/constants";
import { can, type PlatformRole } from "./roles";

export { PRODUCTION_STATES };
export type ProductionState = ProductionStateValue;

export const PRODUCTION_INFO: Record<ProductionState, { label: string; hint: string }> = {
  new: { label: "جديد", hint: "لم يُسند لمنفّذ بعد." },
  assigned: { label: "مُسند", hint: "مُسند لمنفّذ ولم يبدأ البناء." },
  building: { label: "قيد البناء", hint: "المنفّذ يبني المتجر." },
  review: { label: "بانتظار المراجعة", hint: "أرسله المنفّذ؛ المراجع يعتمده أو يعيده." },
  ready: { label: "جاهز للتسليم", hint: "اعتمده المراجع ونجحت قائمة الفحص." },
  delivered: { label: "سُلِّم", hint: "سُلِّم للعميل وبدأت تجربته." },
};

export const isProductionState = (v: unknown): v is ProductionState =>
  typeof v === "string" && (PRODUCTION_STATES as readonly string[]).includes(v);

/** أقل مرحلة يجب أن يراها العميل لكل حالة إنتاج. */
const CLIENT_FLOOR: Record<ProductionState, RequestStage> = {
  new: "received",
  assigned: "received",
  building: "design",
  review: "review",
  ready: "review",
  delivered: "delivery",
};
const STAGE_ORDER: RequestStage[] = ["received", "design", "build", "review", "delivery"];

/** مرحلة العميل بعد انتقال الإنتاج: ترتفع للحد الأدنى إن كانت أقل، ولا تنزل أبداً. */
export function clientStageFor(state: ProductionState, current: RequestStage | null): RequestStage {
  const floor = CLIENT_FLOOR[state];
  if (!current) return floor;
  return STAGE_ORDER.indexOf(current) >= STAGE_ORDER.indexOf(floor) ? current : floor;
}

// ─── قائمة فحص الجودة ───────────────────────────────────────────────────────

export type QaItem = { key: string; label: string; by: "builder" | "reviewer" };

/** ما يثبته المنفّذ قبل الإرسال للمراجعة، ثم ما يثبته المراجع قبل الاعتماد. كل بند فعل حقيقي يمكن التحقق منه. */
export const QA_ITEMS: readonly QaItem[] = [
  { key: "brief", label: "قرأت الـ brief كاملاً (نص كل منتج وسياسات الدفع والشحن)، وشاهدت كل صور العميل", by: "builder" },
  { key: "data", label: "المنتجات والأسعار من العميل فقط، ولا ادعاء ولا رقم بلا مصدر", by: "builder" },
  { key: "checks", label: "stores:check وفحص الأنواع ناجحان على الفرع", by: "builder" },
  { key: "screens", label: "راجعت كل الصفحات على 375px وسطح المكتب، بلا تمرير أفقي", by: "builder" },
  { key: "order", label: "أتممت طلباً تجريبياً كاملاً من السلة حتى صفحة التأكيد", by: "builder" },
  { key: "quality", label: "التقييم الذاتي في DELIVERY.md 91 أو أكثر بلا موانع", by: "builder" },
  { key: "r_look", label: "الشكل يليق بنشاط العميل ومتسق في كل الصفحات", by: "reviewer" },
  { key: "r_truth", label: "لا نص يذكر أدوات البناء أو التقنيات، ولا وعد لم يقله العميل", by: "reviewer" },
  { key: "r_order", label: "جرّبت بنفسي طلباً كاملاً على الموبايل ونجح", by: "reviewer" },
  { key: "r_dashboard", label: "لوحة التاجر فيها المنتجات والإعدادات الصحيحة (الدفع، الشحن، التواصل)", by: "reviewer" },
];

export type QaState = Record<string, { by: string; at: string }>;

export const qaDone = (qa: QaState, by: QaItem["by"]) => QA_ITEMS.filter((i) => i.by === by).every((i) => Boolean(qa[i.key]));

export function readQa(v: unknown): QaState {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: QaState = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (!QA_ITEMS.some((i) => i.key === k)) continue;
    const r = val as { by?: unknown; at?: unknown } | null;
    if (r && typeof r.by === "string" && typeof r.at === "string") out[k] = { by: r.by, at: r.at };
  }
  return out;
}

// ─── الانتقالات ─────────────────────────────────────────────────────────────

export type ProductionActor = { id: string; role: PlatformRole };
export type ProductionRow = { production: ProductionState; builderId: string | null; reviewerId: string | null; qa: QaState };

export type MoveCheck = { ok: true } | { ok: false; error: string };

/**
 * هل يحق لهذا العضو نقل الطلب من حالته إلى `to`؟ يفرضه الخادم قبل أي كتابة.
 * - building: المنفّذ المسند (أو مدير) يبدأ، أو يعود من المراجعة (المراجع يعيده بملاحظة).
 * - review: المنفّذ بعد إكمال بنوده.
 * - ready: المراجع (المسند أو أي مراجع إن لم يُسند) بعد إكمال بنوده، ولا يعتمد عمله هو.
 * - delivered: يتم بإجراء التسليم وحده (لا نقل يدوي).
 */
export function canMove(row: ProductionRow, to: ProductionState, actor: ProductionActor, note?: string | null): MoveCheck {
  const from = row.production;
  if (from === to) return { ok: false, error: "الطلب في هذه الحالة بالفعل." };
  if (from === "delivered") return { ok: false, error: "سُلِّم المتجر؛ التعديلات بعده طلبات تعديل." };
  const manager = can(actor.role, "requests.assign");
  const isBuilder = row.builderId === actor.id && can(actor.role, "requests.work");
  const isReviewer = can(actor.role, "requests.approve") && (row.reviewerId === actor.id || row.reviewerId === null || manager);

  switch (to) {
    case "new":
      return { ok: false, error: "الإعادة لـ «جديد» تتم بإلغاء الإسناد." };
    case "assigned":
      return { ok: false, error: "«مُسند» يحدث تلقائياً عند اختيار منفّذ." };
    case "building":
      if (!row.builderId) return { ok: false, error: "أسند منفّذاً أولاً." };
      if (from === "review" || from === "ready") {
        if (!(isReviewer || manager)) return { ok: false, error: "إعادة المتجر للبناء للمراجع أو المدير." };
        if (!note?.trim()) return { ok: false, error: "اكتب للمنفّذ ما يجب إصلاحه." };
        return { ok: true };
      }
      return isBuilder || manager ? { ok: true } : { ok: false, error: "البدء للمنفّذ المسند أو المدير." };
    case "review":
      if (from !== "building") return { ok: false, error: "الإرسال للمراجعة من «قيد البناء» فقط." };
      if (!(isBuilder || manager)) return { ok: false, error: "الإرسال للمراجعة للمنفّذ المسند أو المدير." };
      if (!qaDone(row.qa, "builder")) return { ok: false, error: "أكمل بنود المنفّذ في قائمة الفحص أولاً." };
      return { ok: true };
    case "ready":
      if (from !== "review") return { ok: false, error: "الاعتماد من «بانتظار المراجعة» فقط." };
      if (!isReviewer) return { ok: false, error: "الاعتماد للمراجع." };
      if (row.builderId === actor.id && actor.role !== "owner") return { ok: false, error: "لا تعتمد متجراً بنيته بنفسك؛ يراجعه غيرك." };
      if (!qaDone(row.qa, "reviewer")) return { ok: false, error: "أكمل بنود المراجع في قائمة الفحص أولاً." };
      return { ok: true };
    case "delivered":
      return { ok: false, error: "التسليم بزر «سلّم للعميل» وحده." };
  }
}

/** من يحق له وضع علامة على بند فحص. */
export function canTickQa(row: ProductionRow, item: QaItem, actor: ProductionActor): boolean {
  if (row.production === "delivered") return false;
  if (can(actor.role, "requests.assign")) return true;
  if (item.by === "builder") return row.builderId === actor.id && can(actor.role, "requests.work");
  return can(actor.role, "requests.approve") && (row.reviewerId === actor.id || row.reviewerId === null);
}

/** المنفّذ يرى ما أُسند إليه فقط؛ الباقون حسب صلاحية «رؤية الكل». */
export function canViewRequest(row: { builderId: string | null; reviewerId: string | null }, actor: ProductionActor): boolean {
  return can(actor.role, "requests.view_all") || row.builderId === actor.id || row.reviewerId === actor.id;
}

// ─── مهلة كل حالة (SLA) ─────────────────────────────────────────────────────

/** ساعات مسموحة في كل حالة قبل اعتبار الطلب متأخراً داخلياً (تُضبط من /admin/flags ← production). */
export const DEFAULT_SLA_HOURS: Record<Exclude<ProductionState, "delivered">, number> = {
  new: 4,
  assigned: 12,
  building: 48,
  review: 12,
  ready: 12,
};

export function slaFrom(config: unknown): typeof DEFAULT_SLA_HOURS {
  const c = (config && typeof config === "object" ? (config as Record<string, unknown>).sla : null) as Record<string, unknown> | null;
  const out = { ...DEFAULT_SLA_HOURS };
  if (c && typeof c === "object") {
    for (const k of Object.keys(out) as (keyof typeof out)[]) {
      const n = Number(c[k]);
      if (Number.isFinite(n) && n >= 1 && n <= 720) out[k] = Math.round(n);
    }
  }
  return out;
}

/** الساعات المتجاوزة للمهلة (0 = في الموعد). */
export function overdueHours(state: ProductionState, since: Date | null, sla: typeof DEFAULT_SLA_HOURS, now = new Date()): number {
  if (state === "delivered" || !since) return 0;
  const spent = (now.getTime() - since.getTime()) / 3_600_000;
  return Math.max(0, Math.floor(spent - sla[state]));
}
