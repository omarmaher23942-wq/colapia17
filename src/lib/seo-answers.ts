// seo-answers.ts — «اسألوا عن المتجر»: إجابات مباشرة عن أكثر ما يسأله المشتري، مولَّدة من سياسات المتجر الفعلية (منطق خالص مختبَر).
//
// الصياغة جواب أولاً (الجملة الأولى تجيب السؤال نفسه) بلا مخاطبة مؤنثة أو مذكرة، فيستطيع محرك البحث أو المساعد الذكي
// اقتباسها كما هي. لا جواب لشيء لم يحدده المتجر: ما لا بيانات له لا يظهر سؤاله أصلاً.
import type { StoreBlueprint } from "@/blueprint/schema";
import { inspectionOffered, reportWindow, type StoreFact } from "@/blueprint/facts";

export type StoreAnswer = { id: string; q: string; a: string };

const egp = (piasters: number) => `${Math.round(piasters / 100).toLocaleString("ar-EG", { numberingSystem: "latn" })} جنيهاً`;

function paymentAnswer(bp: StoreBlueprint): string | null {
  const p = bp.payments;
  const methods = [p.cod.enabled ? "الدفع عند الاستلام" : null, p.vodafoneCash.enabled ? "فودافون كاش" : null, p.instapay.enabled ? "إنستاباي" : null].filter((x): x is string => !!x);
  if (!methods.length) return null;
  const list = methods.length > 1 ? `${methods.slice(0, -1).join("، ")} و${methods[methods.length - 1]}` : methods[0]!;
  const parts = [`تتوفر طرق الدفع التالية: ${list}.`];
  if (p.cod.enabled) parts.push("في الدفع عند الاستلام يُسلَّم المبلغ نقداً للمندوب عند وصول الطلب.");
  if (p.vodafoneCash.enabled || p.instapay.enabled) parts.push(p.requireTransferProof ? "في التحويل يُرفع إيصال الدفع مع الطلب." : "في التحويل يُرسل الدفع إلى بيانات المتجر الظاهرة في صفحة إتمام الطلب.");
  if (p.prepaidDiscountPercent && (p.vodafoneCash.enabled || p.instapay.enabled)) parts.push(`يُمنح خصم ${p.prepaidDiscountPercent}% على الدفع المسبق بالتحويل.`);
  return parts.join(" ");
}

function shippingCostAnswer(bp: StoreBlueprint): string {
  const s = bp.shipping;
  if (s.freeOverPiasters === 0) return "الشحن مجاني على جميع الطلبات.";
  const free = s.freeOverPiasters && s.freeOverPiasters > 0 ? ` ويصبح الشحن مجانياً للطلبات التي تبلغ قيمتها ${egp(s.freeOverPiasters)} أو أكثر.` : "";
  if (s.flatRatePiasters !== null && s.flatRatePiasters !== undefined) {
    return s.flatRatePiasters === 0 ? `الشحن مجاني.${free}` : `رسوم الشحن ثابتة وقدرها ${egp(s.flatRatePiasters)} لأي محافظة.${free}`;
  }
  return `تختلف رسوم الشحن حسب المحافظة، وتظهر بالضبط في صفحة إتمام الطلب قبل التأكيد.${free}`;
}

function areaAnswer(name: string, facts: StoreFact[] | undefined): string {
  const nationwide = facts?.some((f) => f.key === "nationwide");
  const coverage = facts?.find((f) => f.key === "coverage");
  if (nationwide) return `يوصّل ${name} إلى جميع المحافظات حتى باب المنزل أو العمل.`;
  if (coverage) return `يوصّل ${name} إلى ${coverage.title.replace(/^شحن إلى\s*/, "")}، وتظهر المحافظات المتاحة في صفحة إتمام الطلب.`;
  return `يوصّل ${name} إلى المحافظات المتاحة في صفحة إتمام الطلب، حتى باب المنزل أو العمل.`;
}

function returnsAnswer(bp: StoreBlueprint): string {
  const r = bp.returns;
  if (r.windowDays <= 0 || (!r.allowExchange && !r.allowRefund)) {
    return "لا يتاح الاستبدال أو الاسترجاع بعد الاستلام." + (inspectionOffered(bp) ? " لذلك تُتاح معاينة المنتج مع المندوب قبل الدفع." : "");
  }
  const what = r.allowExchange && r.allowRefund ? "الاستبدال والاسترجاع" : r.allowExchange ? "الاستبدال" : "الاسترجاع";
  const fees =
    r.returnShippingPaidBy === "store" ? " ويتحمل المتجر مصاريف شحن المرتجع." : r.returnShippingPaidBy === "customer" ? " وتكون مصاريف شحن المرتجع على العميل." : " وتكون مصاريف شحن المرتجع على العميل عند تغيير الرأي أو المقاس.";
  const refund = r.allowRefund ? ` يُرد المبلغ خلال ${r.refundDays} أيام عمل من استلام المرتجع.` : "";
  return `يمكن طلب ${what} خلال ${r.windowDays} يوماً من الاستلام.${fees}${refund}`;
}

function defectAnswer(bp: StoreBlueprint): string | null {
  const r = bp.returns;
  if (r.defectPolicy === "none") return null;
  const within = `يجب إبلاغ المتجر خلال ${reportWindow(r.defectReportHours)} من الاستلام`;
  const ship = r.defectShippingByStore ? "ويتحمل المتجر مصاريف الشحن كاملة" : "وتكون مصاريف الشحن على العميل";
  const how: Record<Exclude<typeof r.defectPolicy, "none">, string> = {
    replace_or_refund: "ويُستبدل المنتج أو يُرد ثمنه كاملاً",
    replace: "ويُستبدل بمنتج سليم",
    refund: "ويُرد ثمنه كاملاً",
    case_by_case: "مع صورة توضح المشكلة، وتُراجع الحالة ويُتفق على الحل المناسب",
  };
  return `نعم، يُعالج المنتج المعيب أو المخالف للطلب: ${within}، ${how[r.defectPolicy]}${r.defectPolicy === "case_by_case" ? "" : `، ${ship}`}.`;
}

function contactAnswer(name: string, bp: StoreBlueprint): string | null {
  const c = bp.channels;
  const ways = [
    c.whatsappNumber ? `واتساب على الرقم ${c.whatsappNumber}` : null,
    c.phone && c.phone !== c.whatsappNumber ? `الهاتف ${c.phone}` : null,
    c.email ? `البريد الإلكتروني ${c.email}` : null,
    c.instagramUsername ? `إنستجرام @${c.instagramUsername.replace(/^@+/, "")}` : null,
    c.messengerPageUsername ? `ماسنجر ${c.messengerPageUsername}` : null,
  ].filter((x): x is string => !!x);
  if (!ways.length) return null;
  return `يمكن التواصل مع ${name} عبر ${ways.join("، أو ")}.`;
}

/** كل الإجابات التي لها بيانات في المتجر، بترتيب أهميتها للمشتري قبل الطلب. */
export function storeAnswers(bp: StoreBlueprint, facts?: StoreFact[]): StoreAnswer[] {
  const name = bp.brand.name;
  const s = bp.shipping;
  const out: StoreAnswer[] = [];
  const add = (id: string, q: string, a: string | null) => {
    if (a && a.trim()) out.push({ id, q, a: a.trim() });
  };

  const min = bp.checkout.minOrderPiasters;
  add(
    "order",
    `كيف يتم الطلب من ${name}؟`,
    `يتم الطلب بإضافة المنتجات إلى السلة ثم إكمال بيانات التوصيل وتأكيد الطلب، فيصل كود الطلب لمتابعته من صفحة تتبع الطلب.${min ? ` الحد الأدنى للطلب ${egp(min)}.` : ""}`,
  );
  add("delivery-time", "كم تستغرق مدة التوصيل؟", s.generalEta ? `يصل الطلب عادةً خلال ${s.generalEta} من تأكيده.` : null);
  add("delivery-area", `إلى أين يوصّل ${name}؟`, areaAnswer(name, facts));
  add("shipping-cost", "كم تبلغ رسوم الشحن؟", shippingCostAnswer(bp));
  add("payment", "ما طرق الدفع المتاحة؟", paymentAnswer(bp));
  if (bp.payments.cod.enabled) {
    add(
      "inspection",
      "هل يمكن معاينة المنتج قبل الدفع؟",
      inspectionOffered(bp)
        ? "نعم، يمكن فتح الشحنة ومعاينة المنتج مع المندوب قبل الدفع، وإن لم يطابق الطلب يمكن رفض الاستلام."
        : "لا، لا تتاح معاينة المنتج قبل الدفع، لكن يمكن الاستبدال أو الاسترجاع وفق سياسة المتجر.",
    );
  }
  add("returns", "ما سياسة الاستبدال والاسترجاع؟", returnsAnswer(bp));
  add("defect", "ماذا لو وصل منتج معيب أو مخالف للطلب؟", defectAnswer(bp));
  add("pickup", "هل يمكن الاستلام من المتجر؟", s.pickupEnabled && s.pickupAddress ? `نعم، يمكن استلام الطلب من ${s.pickupAddress} بلا رسوم شحن.` : null);
  add("contact", `كيف يمكن التواصل مع ${name}؟`, contactAnswer(name, bp));
  return out;
}

/** نص الصفحة (ماركداون): مقدمة وسؤال لكل عنوان وجوابه فقرة تليه. */
export function answersMarkdown(name: string, answers: StoreAnswer[]): string {
  return [`إجابات مباشرة عن أكثر ما يُسأل عنه قبل الطلب من ${name}، مأخوذة من سياسات المتجر المعمول بها الآن.`, ...answers.flatMap((a) => [`## ${a.q}`, a.a])].join("\n");
}
