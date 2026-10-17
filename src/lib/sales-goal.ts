// sales-goal.ts — هدف المبيعات الشهري ووتيرته، وصافي الربح بعد الإعلانات، والعائد على الإنفاق الإعلاني (منطق خالص مختبَر).
// كل رقم محسوب من بيانات المتجر الفعلية؛ ما لا يمكن حسابه يعود null ولا يُعرض رقم مخترع.
export type GoalPrefs = { monthlyGoalEgp: number | null; adSpend: Record<string, number> };

export const monthKey = (d: Date): string => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit" }).formatToParts(d);
  return `${p.find((x) => x.type === "year")!.value}-${p.find((x) => x.type === "month")!.value}`;
};

const cleanEgp = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 && v <= 1_000_000_000 ? Math.round(v) : null);

/** يقرأ الهدف والإنفاق الإعلاني من stores.prefs (قيم تالفة تُتجاهل). */
export function readGoalPrefs(prefs: unknown): GoalPrefs {
  const p = (prefs && typeof prefs === "object" ? prefs : {}) as Record<string, unknown>;
  const spendRaw = (p.adSpend && typeof p.adSpend === "object" ? p.adSpend : {}) as Record<string, unknown>;
  const adSpend: Record<string, number> = {};
  for (const [k, v] of Object.entries(spendRaw)) {
    const n = cleanEgp(v);
    if (/^\d{4}-\d{2}$/.test(k) && n !== null) adSpend[k] = n;
  }
  return { monthlyGoalEgp: cleanEgp(p.monthlyGoalEgp), adSpend };
}

/** يدمج هدفاً جديداً (null = إلغاء) في prefs دون المساس بباقي المفاتيح. */
export function withGoal(prefs: Record<string, unknown>, goalEgp: number | null): Record<string, unknown> {
  const next = { ...prefs };
  if (goalEgp === null) delete next.monthlyGoalEgp;
  else next.monthlyGoalEgp = goalEgp;
  return next;
}

/** يدمج إنفاق شهر (0 أو null = حذفه). يحتفظ بآخر 12 شهراً. */
export function withAdSpend(prefs: Record<string, unknown>, month: string, spendEgp: number | null): Record<string, unknown> {
  const cur = readGoalPrefs(prefs).adSpend;
  if (spendEgp === null || spendEgp <= 0) delete cur[month];
  else cur[month] = Math.round(spendEgp);
  const keep = Object.keys(cur).sort().slice(-12);
  return { ...prefs, adSpend: Object.fromEntries(keep.map((k) => [k, cur[k]!])) };
}

export type PaceStatus = "none" | "reached" | "ahead" | "on_track" | "behind";
export type Pace = {
  status: PaceStatus;
  pct: number;
  expectedPct: number;
  projectedPiasters: number;
  remainingPiasters: number;
  perDayNeededPiasters: number;
  daysLeft: number;
};

/** وتيرة الشهر: ما بيع حتى الآن مقابل المتوقع بالتناسب مع أيام الشهر، وتوقع نهاية الشهر بنفس المعدل اليومي. */
export function goalPace(input: { goalEgp: number | null; soldPiasters: number; dayOfMonth: number; daysInMonth: number }): Pace {
  const goal = (input.goalEgp ?? 0) * 100;
  const day = Math.min(Math.max(1, input.dayOfMonth), input.daysInMonth);
  const daysLeft = input.daysInMonth - day;
  const projected = Math.round((input.soldPiasters / day) * input.daysInMonth);
  if (goal <= 0) return { status: "none", pct: 0, expectedPct: 0, projectedPiasters: projected, remainingPiasters: 0, perDayNeededPiasters: 0, daysLeft };
  const pct = Math.round((input.soldPiasters / goal) * 100);
  const expectedPct = Math.round((day / input.daysInMonth) * 100);
  const remaining = Math.max(0, goal - input.soldPiasters);
  const status: PaceStatus = input.soldPiasters >= goal ? "reached" : projected >= goal * 1.05 ? "ahead" : projected >= goal * 0.9 ? "on_track" : "behind";
  return { status, pct, expectedPct, projectedPiasters: projected, remainingPiasters: remaining, perDayNeededPiasters: daysLeft > 0 ? Math.ceil(remaining / daysLeft) : remaining, daysLeft };
}

export const PACE_TEXT: Record<Exclude<PaceStatus, "none">, string> = {
  reached: "تحقق هدف هذا الشهر. أي مبيعات إضافية ربح فوق الهدف.",
  ahead: "وتيرتكم أسرع من المطلوب، وبهذا المعدل يتجاوز الشهر الهدف.",
  on_track: "وتيرتكم قريبة من الهدف، واستمرار المعدل الحالي يكفي تقريباً.",
  behind: "وتيرتكم أبطأ من المطلوب. رفع المبيعات اليومية للمبلغ أدناه يعيد الهدف في المتناول.",
};

/** صافي الربح = الربح التقديري (بعد التكلفة والخصم) ناقص الإنفاق الإعلاني. null إن لم تُعرف التكلفة. */
export function netProfit(profitPiasters: number | null, adSpendEgp: number): number | null {
  if (profitPiasters === null) return null;
  return profitPiasters - Math.max(0, adSpendEgp) * 100;
}

/** العائد على الإنفاق الإعلاني: المبيعات ÷ الإنفاق. null بلا إنفاق مسجّل. */
export function roas(salesPiasters: number, adSpendEgp: number): number | null {
  if (adSpendEgp <= 0) return null;
  return Math.round((salesPiasters / 100 / adSpendEgp) * 10) / 10;
}

// ———— توصيات أسبوعية من بيانات المتجر ————
export type WeeklyInput = {
  viewedNotBought: { name: string; viewers: number } | null;
  lowSizes: { product: string; label: string; stock: number }[];
  topSource: { source: string; orders: number; share: number } | null;
  quietDays: number | null;
};
export type Recommendation = { key: string; title: string; text: string; href: string };

export function weeklyRecommendations(i: WeeklyInput): Recommendation[] {
  const out: Recommendation[] = [];
  if (i.viewedNotBought && i.viewedNotBought.viewers >= 5)
    out.push({
      key: "viewed",
      title: `«${i.viewedNotBought.name}» يُشاهد ولا يُطلب`,
      text: `شاهده ${i.viewedNotBought.viewers} زائر هذا الأسبوع دون طلب. راجعوا صوره وسعره ووصفه، أو جرّبوا كود خصم قصير له.`,
      href: "/dashboard/products",
    });
  const low = i.lowSizes[0];
  if (low)
    out.push({
      key: "sizes",
      title: "مقاسات توشك أن تنفد",
      text: `${low.product} (${low.label}) متبقٍ منه ${low.stock}${i.lowSizes.length > 1 ? `، و${i.lowSizes.length - 1} تركيبات أخرى قاربت النفاد` : ""}. جهّزوا التوريد قبل أن يخسر المتجر طلبات.`,
      href: "/dashboard/products?stock=low",
    });
  if (i.topSource && i.topSource.orders >= 3)
    out.push({
      key: "source",
      title: `أكثر الطلبات تأتي من ${i.topSource.source}`,
      text: `${i.topSource.share}% من طلبات الأسبوع جاءت من هذا المصدر. ضاعفوا المحتوى فيه واستخدموا رابط حملة مخصصاً لقياسه.`,
      href: "/dashboard/marketing",
    });
  if (!out.length && i.quietDays !== null && i.quietDays >= 3)
    out.push({ key: "share", title: "شاركوا المتجر اليوم", text: "مرت أيام دون طلبات. نشر منتج واحد في ستوري مع رابط المتجر أسرع طريق لأول طلب.", href: "/dashboard/studio" });
  return out.slice(0, 3);
}
