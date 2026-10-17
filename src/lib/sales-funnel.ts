// sales-funnel.ts — قمع مبيعات الوكالة (الجولة 4.1): من أول رسالة إلى الدفع، بنسبة كل خطوة من التي قبلها وأين يضيع
// أكثر الناس. منطق خالص مختبَر؛ الأعداد من `server/repos/sales-funnel.ts`. لا أرقام مخترعة: نسبة بلا أساس = null.

export const FUNNEL_RANGES = [7, 30, 90] as const;
export type FunnelRange = (typeof FUNNEL_RANGES)[number];

export type FunnelCounts = {
  /** محادثات جديدة (إعلانات ورسائل) في الفترة. */
  conversations: number;
  /** من هذه المحادثات: كم اكتملت بياناتها الأربع (النشاط، الاسم، البريد، واتساب). */
  leads: number;
  /** متاجر أنشأها الوكيل من المحادثات في الفترة. */
  created: number;
  /** من هذه المتاجر: كم أكمل صاحبها الإعداد. */
  setupDone: number;
  /** ومنها: كم دفع (باقة أولى مقبولة)، ومنها مقاعد الدائرة الذهبية. */
  paid: number;
  paidGolden: number;
  /** إيراد الباقات الأولى المقبولة في الفترة بالقروش، والتجديدات المقبولة فيها. */
  revenue: number;
  renewals: number;
};

export type FunnelStep = { key: string; label: string; value: number; rate: number | null; hint: string };

const rate = (n: number, d: number) => (d > 0 ? Math.min(100, Math.round((n / d) * 100)) : null);

export function funnelSteps(c: FunnelCounts): FunnelStep[] {
  return [
    { key: "conversations", label: "محادثات جديدة", value: c.conversations, rate: null, hint: "من الإعلانات والرسائل" },
    { key: "leads", label: "بيانات كاملة", value: c.leads, rate: rate(c.leads, c.conversations), hint: "من المحادثات" },
    { key: "created", label: "متاجر أُنشئت", value: c.created, rate: rate(c.created, c.leads), hint: "من البيانات الكاملة" },
    { key: "setupDone", label: "أكملوا الإعداد", value: c.setupDone, rate: rate(c.setupDone, c.created), hint: "من المتاجر المنشأة" },
    { key: "paid", label: "دفعوا", value: c.paid, rate: rate(c.paid, c.setupDone), hint: "ممن أكملوا الإعداد" },
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
  leads: "المحادثات لا تكتمل بياناتها: راجع ردود الوكيل في «المحادثات»، وأين يتوقف العملاء (غالباً عند البريد أو الرقم).",
  created: "بيانات كاملة بلا متجر: العملاء لم يوافقوا بعد على بدء التجهيز، أو بلغ السقف اليومي. راجعوا المحادثات وسقف المتاجر في الإعدادات.",
  setupDone: "متاجر أُنشئت ولم يكتمل إعدادها: راجعوا وصول رابط الإعداد (الرسالة والبريد) والتذكيرات، وأرسلوه يدوياً من صفحة المحادثة.",
  paid: "متاجر مكتملة ولا تدفع: راجعوا رسائل التجربة وصفحة الدفع، وتواصلوا مع من انتهت تجربته اليوم.",
};
