// config.ts — إعداد وكيل الرسائل (خالص، بلا خادم). يُضبط من /admin/flags ← «agent».
// مثال: { "setupDelayMinutes": 30, "setupDays": 14, "dailyStoreCap": 40, "handoffPauseHours": 3, "buildWindowHours": 48, "demoUrl": "" }

export type AgentConfig = {
  /** دقائق الانتظار بين إنشاء المتجر وإرسال رابط الإعداد. 0 = فوراً. */
  setupDelayMinutes: number;
  /** أيام انتظار إكمال الإعداد قبل حذف المتجر غير المكتمل. */
  setupDays: number;
  /** سقف المتاجر المُنشأة آلياً في اليوم (حماية من الإساءة)؛ يصل المالك تنبيه عند بلوغه. */
  dailyStoreCap: number;
  /** مدة إيقاف الوكيل بعد طلب الموظف (ساعات). */
  handoffPauseHours: number;
  /** المدة التي يعد بها الوكيل لوصول رابط الإعداد بعد طلب البناء (ساعات). */
  buildWindowHours: number;
  /** رابط المتجر التجريبي. فارغ = demo.<النطاق الرئيسي>. */
  demoUrl: string;
};

export const AGENT_FLAG = "agent";

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  setupDelayMinutes: 30,
  setupDays: 14,
  dailyStoreCap: 40,
  handoffPauseHours: 3,
  buildWindowHours: 48,
  demoUrl: "",
};

const int = (v: unknown, fallback: number, min: number, max: number): number => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};

/** يقرأ الإعداد المخزن بتسامح: القيم الخاطئة ترجع للافتراضي، والحدود مضبوطة. */
export function agentConfigFrom(raw: unknown): AgentConfig {
  const c = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_AGENT_CONFIG;
  const demo = typeof c.demoUrl === "string" ? c.demoUrl.trim() : "";
  return {
    setupDelayMinutes: int(c.setupDelayMinutes, d.setupDelayMinutes, 0, 24 * 60),
    setupDays: int(c.setupDays, d.setupDays, 2, 60),
    dailyStoreCap: int(c.dailyStoreCap, d.dailyStoreCap, 1, 1000),
    handoffPauseHours: int(c.handoffPauseHours, d.handoffPauseHours, 1, 72),
    buildWindowHours: int(c.buildWindowHours, d.buildWindowHours, 2, 240),
    demoUrl: /^https:\/\/[^\s]+$/.test(demo) ? demo.replace(/\/+$/, "") : "",
  };
}

/** رابط الديمو الفعلي. */
export const demoUrlFor = (cfg: Pick<AgentConfig, "demoUrl">, rootDomain: string) => cfg.demoUrl || `https://demo.${rootDomain}`;

/** موقع Qima: عمل حقيقي نفّذه الفريق، يعرضه الوكيل دليلاً لمن يتشكك أو يطلب أمثلة. */
export const QIMA_URL = "https://qima-ten.vercel.app";
