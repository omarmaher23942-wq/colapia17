// niche-defaults.ts — إعدادات مقترحة حسب نوع النشاط (خالص ومختبَر): سياسة الاستبدال ومدة التوصيل وتنبيهات خاصة بالنشاط.
// اقتراحات فقط: يراجعها التاجر ويعدّلها، ولا تُحفظ دون موافقته.
import type { Niche } from "@/lib/niche-attributes";

export type NicheSuggestion = {
  returnsDays: number;
  allowRefund: boolean;
  etaMin: number;
  etaMax: number;
  /** سبب الاقتراح بجملة قصيرة تظهر للتاجر. */
  why: string;
  /** تنبيه عملي يخص النشاط. */
  tip: string;
};

export const NICHE_SUGGESTIONS: Record<Niche, NicheSuggestion> = {
  fashion: { returnsDays: 14, allowRefund: false, etaMin: 2, etaMax: 4, why: "المقاس واللون أكثر أسباب الإرجاع في الملابس، فالاستبدال خلال أسبوعين يطمئن المشتري.", tip: "جدول المقاسات يقلل الاستبدال كثيراً." },
  shoes: { returnsDays: 14, allowRefund: false, etaMin: 2, etaMax: 4, why: "مقاس الحذاء يختلف بين الماركات، فالاستبدال يزيد ثقة المشتري.", tip: "اذكروا طول القدم بالسنتيمتر لكل مقاس." },
  electronics: { returnsDays: 7, allowRefund: true, etaMin: 2, etaMax: 5, why: "الأجهزة تحتاج فترة فحص قصيرة وواضحة بعد الاستلام.", tip: "اذكروا مدة الضمان ونوعه في وصف كل جهاز." },
  beauty: { returnsDays: 0, allowRefund: false, etaMin: 2, etaMax: 4, why: "منتجات العناية المفتوحة لا تُعاد لأسباب صحية، ويتاح الاستبدال عند العيب فقط.", tip: "اذكروا المكونات وتاريخ الصلاحية." },
  perfume: { returnsDays: 0, allowRefund: false, etaMin: 2, etaMax: 4, why: "العطور المفتوحة لا تُعاد، ويتاح الاستبدال عند العيب أو الخطأ في الطلب.", tip: "اذكروا الحجم بالمللي ونوع التركيز." },
  food: { returnsDays: 0, allowRefund: false, etaMin: 1, etaMax: 2, why: "الأغذية سريعة التلف ولا تُعاد، وتُراجع عند وصولها تالفة فقط.", tip: "اذكروا تاريخ الإنتاج والصلاحية وطريقة الحفظ." },
  home: { returnsDays: 14, allowRefund: true, etaMin: 3, etaMax: 7, why: "الأثاث والأدوات المنزلية قد تحتاج وقتاً أطول في الشحن وفترة أطول للفحص.", tip: "اذكروا الأبعاد والخامة بدقة." },
  kids: { returnsDays: 14, allowRefund: false, etaMin: 2, etaMax: 4, why: "مقاسات الأطفال تتغير بين الماركات، فالاستبدال يحمي المشتري.", tip: "اذكروا الفئة العمرية بجانب المقاس." },
  other: { returnsDays: 14, allowRefund: true, etaMin: 2, etaMax: 5, why: "إعداد متوازن يناسب أغلب الأنشطة.", tip: "يمكنكم تعديل أي سياسة لاحقاً من الإعدادات." },
};

export const suggestionFor = (n: Niche): NicheSuggestion => NICHE_SUGGESTIONS[n] ?? NICHE_SUGGESTIONS.other;
