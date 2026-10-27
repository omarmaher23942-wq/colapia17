// conv-filters.ts — فلاتر قائمة المحادثات في لوحة المالك (خالصة ومختبَرة). تقرأ علامات الذاكرة التي يكتبها الوكيل:
// flag = other_service، closedBy = agent_done، وما يكتبه الفريق: assigneeId، followUpAt، notes.
export const CONV_FILTERS = ["all", "unread", "mine", "build_request", "other_service", "awaiting_payment", "human", "hot", "stale", "followup", "closed"] as const;
export type ConvFilter = (typeof CONV_FILTERS)[number];

export const CONV_FILTER_LABEL: Record<ConvFilter, string> = {
  all: "الكل",
  unread: "غير مقروءة",
  mine: "محادثاتي",
  build_request: "طلب بناء جديد",
  other_service: "خدمة أخرى",
  awaiting_payment: "بانتظار الدفع",
  human: "تدخل بشري",
  hot: "ساخنة",
  stale: "بلا رد",
  followup: "متابعة مستحقة",
  closed: "مغلقة",
};

export type ConvRow = {
  stage: string;
  memory: unknown;
  unreadForAdmin: number;
  leadScore: number;
  botPaused: boolean;
  lastUserMessageAt: Date | null;
  lastBotMessageAt: Date | null;
};

export const isConvFilter = (v: unknown): v is ConvFilter => typeof v === "string" && (CONV_FILTERS as readonly string[]).includes(v);

const mem = (m: unknown) => (m && typeof m === "object" ? (m as Record<string, unknown>) : {});
const CLOSED_STAGES = new Set(["lost", "delivered", "activated"]);
export const STALE_AFTER_MS = 24 * 3600_000;

export const isOtherService = (r: ConvRow) => mem(r.memory).flag === "other_service";
export const isAgentClosed = (r: ConvRow) => mem(r.memory).closedBy === "agent_done";
export const assigneeOf = (r: ConvRow): string | null => (typeof mem(r.memory).assigneeId === "string" ? (mem(r.memory).assigneeId as string) : null);
export function followUpAt(r: ConvRow): Date | null {
  const v = mem(r.memory).followUpAt;
  const d = typeof v === "string" ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

/** مغلقة: أغلقها الوكيل بعد الاتفاق أو انتهت (ضائعة/مُسلَّمة/مفعّلة)، وليست خدمة أخرى تنتظر الرد. */
export const isClosed = (r: ConvRow) => (isAgentClosed(r) || CLOSED_STAGES.has(r.stage)) && !isOtherService(r);

/** بانتظار الدفع: أغلق الوكيل المحادثة بعد إرسال رابط الحجز ولم تنتهِ. */
export const isAwaitingPayment = (r: ConvRow) => isAgentClosed(r) && !CLOSED_STAGES.has(r.stage) && !isOtherService(r);

/** آخر رسالة من العميل ولم يُرد عليها منذ أكثر من 24 ساعة (والمحادثة غير مغلقة). */
export function isStale(r: ConvRow, now: number): boolean {
  if (!r.lastUserMessageAt || isClosed(r)) return false;
  const u = r.lastUserMessageAt.getTime();
  const b = r.lastBotMessageAt?.getTime() ?? 0;
  return b < u && now - u > STALE_AFTER_MS;
}

export function matchesFilter(r: ConvRow, f: ConvFilter, ctx: { now: number; me?: string | null }): boolean {
  switch (f) {
    case "all": return true;
    case "unread": return r.unreadForAdmin > 0;
    case "mine": return !!ctx.me && assigneeOf(r) === ctx.me;
    case "build_request": return mem(r.memory).flag === "build_request";
    case "other_service": return isOtherService(r);
    case "awaiting_payment": return isAwaitingPayment(r);
    case "human": return r.stage === "human" || (r.botPaused && !isClosed(r));
    case "hot": return r.leadScore >= 70 && !isClosed(r);
    case "stale": return isStale(r, ctx.now);
    case "followup": { const d = followUpAt(r); return !!d && d.getTime() <= ctx.now; }
    case "closed": return isClosed(r);
  }
}

export function countFilters(rows: ConvRow[], ctx: { now: number; me?: string | null }): Record<ConvFilter, number> {
  const out = Object.fromEntries(CONV_FILTERS.map((f) => [f, 0])) as Record<ConvFilter, number>;
  for (const r of rows) for (const f of CONV_FILTERS) if (matchesFilter(r, f, ctx)) out[f]++;
  return out;
}

/** تهريب أحرف LIKE حتى لا يُفسَّر البحث نمطاً. */
export const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
