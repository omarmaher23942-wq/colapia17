// pause.ts — إيقاف الوكيل في محادثة بعينها (خالص ومختبَر). الإيقاف إما دائم (botPaused بلا موعد) أو مؤقت حتى موعد.
// المؤقت ينتهي وحده فيعود الوكيل، والدائم لا يعود إلا باستئناف يدوي.

export const PAUSE_CHOICES = ["1h", "3h", "24h", "forever"] as const;
export type PauseChoice = (typeof PAUSE_CHOICES)[number];

export const PAUSE_LABEL: Record<PauseChoice, string> = { "1h": "ساعة", "3h": "3 ساعات", "24h": "24 ساعة", forever: "دائماً" };

export const isPauseChoice = (v: unknown): v is PauseChoice => typeof v === "string" && (PAUSE_CHOICES as readonly string[]).includes(v);

/** موعد انتهاء الإيقاف، أو null للإيقاف الدائم. */
export function pauseUntil(choice: PauseChoice, now = Date.now()): Date | null {
  const h = choice === "1h" ? 1 : choice === "3h" ? 3 : choice === "24h" ? 24 : 0;
  return h ? new Date(now + h * 3600_000) : null;
}

/** موعد الإيقاف المؤقت بعد تحويل الوكيل للمحادثة لموظف (ساعات من الإعداد). */
export const handoffUntil = (hours: number, now = Date.now()): Date => new Date(now + hours * 3600_000);

export type PauseState = "active" | "paused" | "expired";

/** حالة الإيقاف الآن: `expired` = كان مؤقتاً وانتهى (على المستدعي أن يستأنف). */
export function pauseState(conv: { botPaused: boolean; botPausedUntil: Date | null }, now = Date.now()): PauseState {
  if (!conv.botPaused) return "active";
  if (conv.botPausedUntil === null) return "paused";
  return conv.botPausedUntil.getTime() > now ? "paused" : "expired";
}

/** وصف عربي قصير للحالة لصفحة المحادثة. */
export function pauseLabel(conv: { botPaused: boolean; botPausedUntil: Date | null }, now = Date.now()): string {
  const s = pauseState(conv, now);
  if (s === "active") return "المساعد يعمل";
  if (s === "expired") return "انتهى الإيقاف وسيعود المساعد مع أول رسالة";
  if (!conv.botPausedUntil) return "المساعد موقوف دائماً";
  const mins = Math.max(1, Math.round((conv.botPausedUntil.getTime() - now) / 60_000));
  return mins < 60 ? `موقوف، يعود بعد ${mins} دقيقة` : `موقوف، يعود بعد ${Math.round(mins / 60)} ساعة`;
}
