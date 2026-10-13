// sales-funnel.ts — قمع مبيعات الوكالة (الجولة 4.1): من أول رسالة إلى الدفع، بنسبة كل خطوة من التي قبلها وأين يضيع
// أكثر الناس. منطق خالص مختبَر؛ الأعداد من `server/repos/sales-funnel.ts`. لا أرقام مخترعة: نسبة بلا أساس = null.

export const FUNNEL_RANGES = [7, 30, 90] as const;
export type FunnelRange = (typeof FUNNEL_RANGES)[number];

export type FunnelCounts = {
  /** محادثات جديدة (إعلانات ورسائل) في الفترة. */
  conversations: number;
  /** استمارات أُرسلت في الفترة. */
  submitted: number;
  /** متاجر سُلّمت للتجربة في الفترة. */
  delivered: number;
  /** باقات أولى قُبل دفعها في الفترة، ومبلغها بالقروش. */
  paid: number;
  revenue: number;
  /** تجديدات قُبلت في الفترة. */
  renewals: number;
  /** من سُلّموا في الفترة: كم دفع منهم حتى الآن (تحويل التجربة لنفس الدفعة). */
  deliveredCohortPaid: number;
};

export type FunnelStep = { key: string; label: string; value: number; rate: number | null; hint: string };

const rate = (n: number, d: number) => (d > 0 ? Math.min(100, Math.round((n / d) * 100)) : null);

export function funnelSteps(c: FunnelCounts): FunnelStep[] {
  return [
    { key: "conversations", label: "محادثات جديدة", value: c.conversations, rate: null, hint: "من الإعلانات والرسائل" },
    { key: "submitted", label: "أرسلوا الاستمارة", value: c.submitted, rate: rate(c.submitted, c.conversations), hint: "من المحادثات" },
    { key: "delivered", label: "استلموا متاجرهم", value: c.delivered, rate: rate(c.delivered, c.submitted), hint: "من الاستمارات" },
    { key: "paid", label: "دفعوا", value: c.paid, rate: rate(c.paid, c.delivered), hint: "من المتاجر المسلّمة" },
  ];
}

/** أضعف خطوة (أقل نسبة بعد الأولى، بأساس 5 على الأقل حتى لا يحكم رقم صغير): حيث يُستثمر الجهد. */
export function weakestStep(steps: FunnelStep[]): FunnelStep | null {
  let worst: FunnelStep | null = null;
  for (let i = 1; i < steps.length; i++) {
    const s = steps[i]!;
    if (s.rate === null || steps[i - 1]!.value < 5) continue;
    if (!worst || s.rate < worst.rate!) worst = s;
  }
  return worst;
}

/** نصيحة واحدة للخطوة الأضعف (مبنية على ما يملكه الفريق فعلاً من أدوات). */
export const STEP_ADVICE: Record<string, string> = {
  submitted: "المحادثات لا تصل للاستمارة: راجع برومبت الوكيل وردوده في «المحادثات»، وهل يرسل الرابط مبكراً بما يكفي.",
  delivered: "استمارات لا تتحول لمتاجر مسلّمة: افتح لوحة الإنتاج وراجع المتأخر و«بانتظار العميل».",
  paid: "متاجر تُسلَّم ولا تدفع: راجع رسائل التجربة وصفحة الدفع، واتصل بمن انتهت تجربته اليوم.",
};
