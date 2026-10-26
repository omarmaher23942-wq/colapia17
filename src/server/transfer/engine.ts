// engine.ts — محرك النسخ الخالص: يقرأ من مصدر ويكتب في هدف عبر "منافذ" (ports) ويحفظ تقدمه كبيانات.
// لا يعرف شيئاً عن Neon أو drizzle، فيُختبر بقاعدة وهمية في الذاكرة. الكتابة upsert فتكون الإعادة آمنة.

export type Row = Record<string, unknown>;

export type Ports = {
  hasTable(name: string): Promise<boolean>;
  count(side: "source" | "target", name: string): Promise<number>;
  read(name: string, offset: number, limit: number): Promise<Row[]>;
  write(name: string, rows: Row[]): Promise<void>;
};

export type TableState = { total: number; copied: number; done: boolean; skipped?: boolean };
export type CopyProgress = {
  /** 1 = نسخ والمتجر يعمل، 2 = مزامنة نهائية والطلبات متوقفة. */
  pass: 1 | 2;
  tables: Record<string, TableState>;
  /** حالة قبول الطلبات قبل أن نوقفها (لإعادتها). */
  prevAccepting?: boolean;
};

export type PlanItem = { name: string; optional?: boolean };

export const BATCH = 400;

export const emptyProgress = (pass: 1 | 2 = 1): CopyProgress => ({ pass, tables: {} });

/** يهيئ أعداد المصدر لكل جدول (ويتجاوز الاختياري الغائب من الهدف إن كان فارغاً). يرمي إن كان الاختياري الغائب غير فارغ. */
export async function prepareProgress(ports: Ports, plan: PlanItem[], pass: 1 | 2, prev?: CopyProgress): Promise<CopyProgress> {
  const out: CopyProgress = { pass, tables: {}, prevAccepting: prev?.prevAccepting };
  for (const item of plan) {
    const total = await ports.count("source", item.name);
    if (item.optional && !(await ports.hasTable(item.name))) {
      if (total > 0) throw new Error(`جدول «${item.name}» به بيانات ولا يوجد في قاعدة الهدف.`);
      out.tables[item.name] = { total: 0, copied: 0, done: true, skipped: true };
      continue;
    }
    out.tables[item.name] = { total, copied: 0, done: total === 0 };
  }
  return out;
}

/** ينسخ دفعات حتى تنتهي الميزانية أو يكتمل كل شيء. يعدّل التقدم في مكانه ويعيد true عند الاكتمال. */
export async function copySteps(
  ports: Ports,
  plan: PlanItem[],
  progress: CopyProgress,
  opts: { budgetMs: number; now?: () => number; onBatch?: () => Promise<void> } = { budgetMs: 30_000 }
): Promise<boolean> {
  const now = opts.now ?? Date.now;
  const started = now();
  for (const item of plan) {
    const st = progress.tables[item.name];
    if (!st || st.done) continue;
    while (!st.done) {
      if (now() - started > opts.budgetMs) return false;
      const rows = await ports.read(item.name, st.copied, BATCH);
      if (rows.length) await ports.write(item.name, rows);
      st.copied += rows.length;
      if (rows.length < BATCH || st.copied >= st.total) st.done = true;
      if (opts.onBatch) await opts.onBatch();
    }
  }
  return plan.every((p) => progress.tables[p.name]?.done);
}

export type Mismatch = { table: string; source: number; target: number };

/** يطابق أعداد الصفوف في المصدر والهدف لكل جدول. القائمة الفارغة = متطابق. */
export async function verifyCounts(ports: Ports, plan: PlanItem[], progress: CopyProgress): Promise<Mismatch[]> {
  const bad: Mismatch[] = [];
  for (const item of plan) {
    if (progress.tables[item.name]?.skipped) continue;
    const [source, target] = await Promise.all([ports.count("source", item.name), ports.count("target", item.name)]);
    if (source !== target) bad.push({ table: item.name, source, target });
  }
  return bad;
}

export function percent(progress: CopyProgress | undefined): number {
  const all = Object.values(progress?.tables ?? {});
  const total = all.reduce((a, t) => a + t.total, 0);
  if (!total) return all.length && all.every((t) => t.done) ? 100 : 0;
  return Math.min(100, Math.round((all.reduce((a, t) => a + Math.min(t.copied, t.total), 0) / total) * 100));
}
