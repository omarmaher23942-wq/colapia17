// stages.ts — مراحل تنفيذ الطلب كما يراها العميل في «متابعة متجرك» ويحركها الفريق من لوحة المالك.
// منطق خالص. حالات الإنتاج الداخلية التفصيلية (المرحلة 3) تُضاف لاحقاً وتُترجم لهذه المراحل الخمس.
import { REQUEST_STAGES, type RequestStage } from "./constants";

export { REQUEST_STAGES, type RequestStage };

export const STAGE_INFO: Record<RequestStage, { label: string; client: string }> = {
  received: { label: "استلمنا الطلب", client: "الفريق يراجع المعلومات والصور، وهيراسلكم لو احتاج أي تفصيلة." },
  design: { label: "التصميم", client: "بنختار الألوان والخطوط وشكل الصفحات اللي يناسب نشاطكم وعملاءكم." },
  build: { label: "البناء", client: "نبني صفحات المتجر ونكتب نصوصه ونجهّز المنتجات المتفق عليها." },
  review: { label: "المراجعة", client: "بنراجع صفحات المتجر على الموبايل والكمبيوتر ونتأكد إن الطلب بيتم صح قبل التسليم." },
  delivery: { label: "التسليم", client: "المتجر جاهز: رابطه والدخول للوحة التحكم هنا تحت وعلى البريد." },
};

export const isStage = (v: unknown): v is RequestStage => typeof v === "string" && (REQUEST_STAGES as readonly string[]).includes(v);

export const stageIndex = (s: RequestStage | null | undefined): number => (s ? REQUEST_STAGES.indexOf(s) : -1);

export const nextStage = (s: RequestStage): RequestStage | null => REQUEST_STAGES[stageIndex(s) + 1] ?? null;

/** الفريق ينقل الطلب لأي مرحلة أخرى (للأمام عادة، وللخلف عند إعادة عمل). نفس المرحلة ليست نقلاً. */
export const canMoveStage = (from: RequestStage | null, to: RequestStage): boolean => from !== to && isStage(to);
