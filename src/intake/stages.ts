// stages.ts — مراحل تنفيذ الطلب كما يراها العميل في «متابعة متجرك» ويحركها الفريق من لوحة المالك.
// منطق خالص. حالات الإنتاج الداخلية التفصيلية (المرحلة 3) تُضاف لاحقاً وتُترجم لهذه المراحل الخمس.
import { REQUEST_STAGES, type RequestStage } from "./constants";

export { REQUEST_STAGES, type RequestStage };

export const STAGE_INFO: Record<RequestStage, { label: string; client: string }> = {
  received: { label: "استلمنا طلبك", client: "الفريق يراجع معلوماتك وصورك، وهيتواصل معاك لو احتاج أي تفصيلة." },
  design: { label: "التصميم", client: "بنختار الألوان والخطوط وشكل الصفحات اللي يناسب نشاطك وزبونك." },
  build: { label: "البناء", client: "بنبني الصفحات ونضيف منتجاتك ونكتب نصوص المتجر." },
  review: { label: "المراجعة", client: "بنراجع كل صفحة على الموبايل والكمبيوتر ونجرب الطلب من أوله لآخره." },
  delivery: { label: "التسليم", client: "متجرك جاهز، وهيوصلك رابطه وطريقة الدخول للوحة التحكم." },
};

export const isStage = (v: unknown): v is RequestStage => typeof v === "string" && (REQUEST_STAGES as readonly string[]).includes(v);

export const stageIndex = (s: RequestStage | null | undefined): number => (s ? REQUEST_STAGES.indexOf(s) : -1);

export const nextStage = (s: RequestStage): RequestStage | null => REQUEST_STAGES[stageIndex(s) + 1] ?? null;

/** الفريق ينقل الطلب لأي مرحلة أخرى (للأمام عادة، وللخلف عند إعادة عمل). نفس المرحلة ليست نقلاً. */
export const canMoveStage = (from: RequestStage | null, to: RequestStage): boolean => from !== to && isStage(to);
