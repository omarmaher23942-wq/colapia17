// stages.ts — مراحل البناء كما يراها التاجر، مشتقة من سجل خطوات الـ workflow.
// سجل المهمة (build_jobs.steps) قائمة أحداث {name, status} تُلحق بالترتيب؛ هنا نحوّلها إلى
// مراحل ثابتة ونسبة تقدم حقيقية، فلا تعرض الواجهة أي حالة لا تعرفها.

export type StageStatus = "pending" | "running" | "done" | "failed";
export type BuildStage = { key: string; label: string; status: StageStatus };

type StageDef = { key: string; label: string; match: (step: string) => boolean; weight: number };

const STAGES: StageDef[] = [
  { key: "direction", label: "فهم نشاطك ومنتجاتك ورسم هوية المتجر", match: (s) => s === "architect" || s === "direction", weight: 18 },
  { key: "copy", label: "كتابة أوصاف المنتجات وعناوين البحث", match: (s) => s.startsWith("products_"), weight: 22 },
  { key: "catalog", label: "ترتيب المنتجات والأقسام والشحن", match: (s) => s === "catalog", weight: 10 },
  { key: "design", label: "تصميم الألوان والخطوط وشكل البطاقات", match: (s) => s === "theme" || s === "design", weight: 18 },
  { key: "pages", label: "كتابة الصفحة الرئيسية وصفحة «من نحن»", match: (s) => s.startsWith("home") || s.startsWith("pages") || s === "copy", weight: 22 },
  { key: "review", label: "مراجعة التصميم والتجربة قبل الإطلاق", match: (s) => s === "qa" || s === "review", weight: 10 },
];

type LogEntry = { name?: unknown; status?: unknown };

/** يحوّل سجل الأحداث إلى مراحل ونسبة تقدم. أي اسم أو حالة غير معروفة تُهمل بأمان. */
export function summarizeBuild(log: unknown, job: { status?: string | null } = {}): { steps: BuildStage[]; progress: number } {
  const entries = (Array.isArray(log) ? log : []) as LogEntry[];
  const state = new Map<string, { running: number; finished: number; failed: boolean }>();
  for (const e of entries) {
    const name = typeof e?.name === "string" ? e.name : "";
    const def = STAGES.find((d) => d.match(name));
    if (!def) continue;
    const s = state.get(def.key) ?? { running: 0, finished: 0, failed: false };
    if (e.status === "running") s.running += 1;
    else if (e.status === "done" || e.status === "degraded") s.finished += 1;
    else if (e.status === "failed") s.failed = true;
    state.set(def.key, s);
  }

  const finishedAll = job.status === "done";
  // المرحلة تكتمل عندما تنتهي كل خطواتها التي بدأت، وتبدأ المرحلة التالية (أو تنتهي المهمة).
  const lastStarted = STAGES.reduce((acc, d, i) => (state.has(d.key) ? i : acc), -1);
  const steps: BuildStage[] = STAGES.map((d, i) => {
    const s = state.get(d.key);
    let status: StageStatus = "pending";
    if (finishedAll) status = "done";
    else if (s?.failed) status = "failed";
    else if (i < lastStarted) status = "done";
    else if (i === lastStarted) status = "running";
    return { key: d.key, label: d.label, status };
  });

  const total = STAGES.reduce((a, d) => a + d.weight, 0);
  let earned = 0;
  steps.forEach((st, i) => {
    const w = STAGES[i]!.weight;
    if (st.status === "done") earned += w;
    else if (st.status === "running") earned += w * 0.45;
  });
  const progress = finishedAll ? 100 : Math.min(97, Math.round((earned / total) * 100));
  return { steps, progress };
}

export const DEFAULT_STAGES: BuildStage[] = STAGES.map((d) => ({ key: d.key, label: d.label, status: "pending" }));
