// replies.ts — ردود الوكيل بالقواعد (منطق خالص مختبَر): تُستخدم حين يتعذر الذكاء الاصطناعي (مفتاح مرفوض، حد معدل...)
// بدل رد واحد ثابت يتكرر لكل رسالة. تقرأ نية آخر رسالة ومجرى المحادثة (ما قلناه سابقاً، هل أُرسل الزر) فتجيب عما سُئل
// عنه فقط، بجمل قصيرة، دون تكرار ما قيل ودون إفصاح استباقي ودون إعادة الرابط بلا طلب. لغة تصلح لمن نكلمه أياً كان.
import { normalizeArabic } from "@/lib/arabic";
import { LINK_REPEAT_MS } from "./policy";

export type Intent = "greeting" | "details" | "price" | "start" | "trust" | "thanks" | "later" | "business" | "shipping" | "payment" | "timing" | "why" | "domain" | "example" | "nonProduct" | "unclear";

export type ReplyVars = { priceLine: string; renewal: string; trialHours: string; remainingLine: string };

export type RuleContext = {
  /** آخر ما كتبه العميل (رسائل الدفعة مجمّعة). */
  text: string;
  /** السجل قبل هذه الرسالة بترتيب زمني. */
  history: { role: "user" | "assistant"; text: string }[];
  /** وقت آخر زر استمارة أُرسل في هذه المحادثة (ms)، أو null. */
  linkSentAt: number | null;
  now: number;
  vars: ReplyVars;
};

export type RuleReply = { reply: string; issueLink: boolean; buttonTitle: string; requestHuman?: string };

// الأنماط على نص مُطبَّع (normalizeArabic). الترتيب في classify يحدد الأولوية.
const RE = {
  greeting: /^(?:hi|hello|hey|hii+|هاي|هلو|هلا|هالو|اهلا|اهلين|مرحبا|مرحبتين|السلام عليكم|سلام عليكم|سلام|صباح الخير|مساء الخير|صباح النور|ازيك|ازي|عامل ايه|يا هلا|اهلا وسهلا)(?:\s|$)/,
  details: /(تفاصيل|اكتر|اشرح|شرح|وضح|توضيح|ايه ده|ايه دي|ايه الخدمه|ايه الفكره|عن ايه|بتعملوا ايه|بتقدموا ايه|ايه بالظبط|ايه هو|ايه هي|فكره|اعرف|ازاي بتشتغلوا|بتشتغلوا ازاي|ايه اللي بتقدموه|details|info|more)/,
  price: /(بكام|بكم|سعر|اسعار|تكلف|ثمن|price|cost|رسوم|اشتراك|عموله|فلوس|مصاريف)/,
  start: /(ابعت|ابعتلي|ابعتيلي|هات|فين)\s*(الفورم|الرابط|اللينك|الاستماره|الزر)|(نبدا|نبدء|ابدا|يلا\s*بينا|يلا\s*نبدا|موافق|مهتم|مهتمين|عايز\s*(ابدا|اجرب)|عاوز\s*(ابدا|اجرب)|اجرب|ازاي\s*(ابدا|اجرب)|طريقه\s*(البدء|التجربه)|رابط\s*(الاستماره|التسجيل)|ابعته|ابعتها)/,
  trust: /(نصب|مضمون|حقيقي|واثق|ضمان|ثقه|هتسلموا|هتسلمولي|اتاكد|ايه اللي يضمنلي|مين انتو|انتو مين|شركه ايه|ازاي اثق|مش واثق|حقيقيه)/,
  thanks: /^(?:شكرا|شكرا جزيلا|تسلم|تسلمي|ميرسي|متشكر|متشكره|thanks|thx|thank you|الف شكر)(?:\s|$)/,
  later: /(هفكر|بعدين|مش دلوقتي|مشغول|مشغوله|مش محتاج|مش محتاجه|لا شكرا|مش مهتم|مش مهتمه|وقت تاني|مره تانيه)/,
  business: /(ملابس|ازياء|فساتين|عبايات|طرح|احذيه|كوتشي|حذيه|شنط|ساعات|نظارات|اكسسوار|عطور|برفان|ميك\s*اب|مكياج|الكترونيات|موبايلات|لابتوب|ادوات\s*منزليه|مطبخ|محل|براند|بوتيك|ماركه|ببيع|بنبيع|بشتغل|منتجات|بضاعه|بيزنس|بيج)/,
  shipping: /(شحن|توصيل|بوسطه|ارامكس|مندوب|المحافظات)/,
  payment: /(طرق\s*الدفع|ادفع\s*ازاي|الدفع\s*ازاي|فودافون|انستا\s*باي|instapay|كاش|الدفع\s*عند\s*الاستلام|فيزا|visa|بوابه\s*دفع|كارت)/,
  timing: /(امتي|كام\s*يوم|مده\s*(?:التسليم|الشغل|التنفيذ)|هيخلص|هتخلص|وقت\s*التسليم|ياخد\s*وقت|ميعاد|مواعيد|بيتسلم)/,
  why: /(ليه|الفرق|احسن\s*من|افضل\s*من|مميزات|فايده|بدل\s*(?:ال)?دايركت|مش\s*كفايه)/,
  domain: /(دومين|اسم\s*الموقع|رابط\s*خاص|\.com)/,
  example: /(مثال|امثله|نماذج|شغل\s*سابق|اعمالكم|معرض\s*اعمال|عملاء\s*سابقين|وريني|ورونا)/,
  nonProduct: /(مطعم|مطاعم|عياده|دكتور|طبيب|كورس|كورسات|دورات|عقار|عقارات|صالون|كوافير|مدرسه|محاسب|محاماه|سباك|ورشه\s*سيارات)/,
};

const norm = (s: string) => normalizeArabic(s).replace(/[؟?!.,،:;"“”()\[\]]/g, " ").replace(/\s+/g, " ").trim();

/** النوايا في الرسالة بترتيب الأهمية (قد تحمل أكثر من نية: «هاي بكام؟»). */
export function intentsOf(text: string): Intent[] {
  const t = norm(text);
  if (!t) return ["unclear"];
  const out: Intent[] = [];
  if (RE.start.test(t)) out.push("start");
  if (RE.price.test(t)) out.push("price");
  // «هتسلموا امتى؟» سؤال موعد لا ثقة، فالموعد قبل الثقة.
  if (RE.timing.test(t)) out.push("timing");
  if (RE.trust.test(t)) out.push("trust");
  if (RE.nonProduct.test(t)) out.push("nonProduct");
  if (RE.shipping.test(t)) out.push("shipping");
  if (RE.payment.test(t)) out.push("payment");
  if (RE.domain.test(t)) out.push("domain");
  if (RE.example.test(t)) out.push("example");
  if (RE.why.test(t)) out.push("why");
  if (RE.details.test(t)) out.push("details");
  if (RE.later.test(t)) out.push("later");
  if (RE.thanks.test(t)) out.push("thanks");
  if (RE.business.test(t)) out.push("business");
  if (RE.greeting.test(t)) out.push("greeting");
  return out.length ? out : ["unclear"];
}

// ─── الصيغ (أكثر من صيغة لكل نية: لا نكرر ما قلناه) ──────────────────────────

const variants = (v: ReplyVars) => ({
  greetingFirst: [
    "أهلاً وسهلاً! إيه نشاطكم، وإيه المنتجات اللي بتعرضوها؟",
    "أهلاً بحضرتك! نشاطك إيه الأول؟ أول ما نعرفه نوضح لك الباقي.",
    "أهلاً! نشاطك إيه؟ ونشوف سوا الأنسب لك.",
  ],
  greetingAgain: ["أهلاً مرة تانية! نشاطكم إيه؟", "نكمّل: إيه نشاطكم ومنتجاتكم؟"],
  details: [
    `إحنا فريق Colapia: بنصمم ونبني لنشاطكم متجر أونلاين كامل بمنتجاتكم وصوركم وبنستضيفه، ومن غير عمولة على مبيعاتكم. وبعد التسليم يتجرب ${v.trialHours} ساعة قبل أي دفع. نشاطكم إيه؟`,
    `الخطوات بسيطة: بتضيفوا من 3 لـ 6 منتجات بوصف بسيط وصور (دقايق قليلة)، وفريقنا يجهّز المتجر ويراجعه ويسلمه لكم، وبعدها يتجرب ${v.trialHours} ساعة. تحبوا نوضح السعر ولا طريقة التسليم؟`,
    "أي جزء مش واضح: السعر، ولا موعد التسليم، ولا شكل المتجر، ولا الدفع من العملاء؟",
  ],
  price: [
    `الباقة ${v.priceLine} وتشمل المتجر نفسه وسنة استضافة كاملة، ومن غير عمولة على أي بيعة. ${v.remainingLine}ويتجرب ${v.trialHours} ساعة قبل الدفع.`,
    `السعر ${v.priceLine} شامل كل حاجة، والتجديد بعد السنة الأولى ${v.renewal} جنيه في السنة. ولو ناسبكم نبدأ، والاستمارة بتاخد دقايق.`,
  ],
  trust: [
    `حقكم تسألوا. الأمان إنكم مش بتدفعوا قبل ما تشوفوا متجركم جاهز وتجربوه ${v.trialHours} ساعة، ولو مش مقتنعين مفيش أي التزام. وفي أي وقت اكتبوا «موظف» وهيكلمكم حد من الفريق.`,
    "الدفع بيتم بعد ما تجربوا المتجر بأنفسكم، بتحويل فودافون كاش أو إنستاباي وإحنا بنراجع الإيصال. وأي حاجة مش واضحة اكتبوا «موظف» وهيكلمكم حد من الفريق.",
  ],
  start: [
    "تمام، دي استمارة المتجر: اسم المتجر ووسيلة تواصل، ومنتجاتكم (كلام بسيط عن كل منتج وصوره لو موجودة)، وطريقة الدفع والتوصيل. بتاخد دقايق قليلة.",
    "ده الرابط تاني، وتكملوا من نفس المكان لو كنتم بدأتم قبل كده.",
  ],
  business: [
    `حلو، النشاط ده مناسب لمتجر أونلاين. نبدأ بالاستمارة؟ بتاخد دقايق، وبعدها بنجهّز المتجر ويتجرب ${v.trialHours} ساعة قبل أي دفع.`,
  ],
  shipping: [
    "الشحن بيتحسب في المتجر لكل محافظة بالأسعار اللي بتحددوها من لوحتكم، أو سعر موحد، أو شحن مجاني فوق مبلغ معين. والطلب بيوصل لكم جاهز بعنوان العميل وتفاصيله، وانتم اللي بتختاروا شركة الشحن.",
    "ولو حبيتوا الشحن المجاني فوق مبلغ معين، المتجر بيعرض ده للعميل وهو بيشتري. أي تفصيلة تانية في الشحن اكتبوها.",
  ],
  payment: [
    "العميل بيدفع في متجركم بالطرق اللي تفعلوها: الدفع عند الاستلام، أو فودافون كاش، أو إنستاباي برفع صورة التحويل. وفي الدفع عند الاستلام فيه رابط تأكيد للطلب وتنبيه للطلبات المقلقة قبل الشحن.",
    "أما باقة Colapia نفسها فبتدفعوها بتحويل فودافون كاش أو إنستاباي بعد ما تجربوا المتجر، وإحنا بنراجع الإيصال.",
  ],
  timing: [
    "موعد التسليم التقديري بيظهر لكم فور ما تبعتوا الاستمارة، وبتتابعوا كل مرحلة من صفحة «متابعة متجرك».",
    `وبعد التسليم بتجربوا المتجر ${v.trialHours} ساعة قبل أي دفع.`,
  ],
  why: [
    "المتجر بيجمع الطلبات في لوحة واحدة بالمقاس واللون والمخزون بدل ما تتلخبط بين الرسايل، والعميل بيشتري بنفسه في أي وقت من غير ما يستنى رد على الدايركت، وبعد كل طلب بتتبعتلكم رسالة واتساب جاهزة بالرقم والتفاصيل. وإنستجرام يفضل واجهتكم زي ما هو.",
    "وكمان فيه روابط حملات تقيس كل إعلان، وبكسل ميتا وتيك توك. نشاطكم إيه عشان نوضح الأنسب؟",
  ],
  domain: ["تقدروا تربطوا دومين البراند الخاص من لوحة التحكم، وبيشتغل المتجر عليه."],
  example: [`كل متجر بيتصمم لبراند واحد ومنتجاته، ومتجركم هتشوفوه جاهز وتجربوه ${v.trialHours} ساعة قبل أي دفع، فتقرروا وانتم شايفين الشغل بنفسكم.`],
  nonProduct: ["حالياً بنبني متاجر بتبيع منتجات فقط، ونشاط زي ده مش متاح عندنا دلوقتي. لو عندكم منتجات بتبيعوها أونلاين يسعدنا نبدأ."],
  thanks: ["العفو، أي وقت.", "في الخدمة. لو في سؤال تاني اكتبوه."],
  later: ["تمام، براحتكم. لو احتجتم أي حاجة إحنا هنا.", "ولا يهمكم. الاستمارة موجودة وقت ما تحبوا."],
  unclearFirst: ["ممكن توضحوا أكتر؟ نشاطكم إيه، وبتبيعوا إيه دلوقتي؟"],
  unclearAgain: ["مش واضح لنا قصدكم بالضبط. لو حابين تكلموا حد من الفريق اكتبوا «موظف»."],
  stuck: ["لو في أي سؤال تاني اكتبوه، أو اكتبوا «موظف» وهيكلمكم حد من الفريق."],
});

const BUTTON = "ابدأ استمارة متجرك";

/**
 * رد القواعد: يختار صيغة لم تُستخدم في هذه المحادثة. الرابط يُرسل فقط عند طلب صريح للبدء، أو أول مرة يذكر نشاطه، أو بعد
 * شرح السعر لمن لم يصله زر؛ ولا يُكرَّر خلال LINK_REPEAT_MS إلا إن طلبه.
 */
export function ruleReply(ctx: RuleContext): RuleReply {
  const intents = intentsOf(ctx.text);
  const V = variants(ctx.vars);
  const used = new Set(ctx.history.filter((h) => h.role === "assistant").map((h) => norm(h.text.replace(/\n?\[زر الاستمارة[^\]]*\]/g, ""))));
  const spoke = ctx.history.some((h) => h.role === "assistant");
  const linkRecent = ctx.linkSentAt !== null && ctx.now - ctx.linkSentAt < LINK_REPEAT_MS;
  const linkEver = ctx.linkSentAt !== null;
  const fresh = (list: string[]) => list.find((t) => !used.has(norm(t)));
  const pick = (list: string[]) => fresh(list) ?? null;
  const reply = (text: string, link = false, requestHuman?: string): RuleReply => ({ reply: text, issueLink: link, buttonTitle: BUTTON, ...(requestHuman ? { requestHuman } : {}) });
  // لا شيء جديد نقوله: جملة تعرض المتابعة، فإن سبقت (أي يكرر العميل نفس الأسئلة) نحوّله لموظف بدل أن نعيدها.
  const stuck = (): RuleReply => (used.has(norm(V.stuck[0]!)) ? reply(V.stuck[0]!, false, "العميل يعيد أسئلته ولا جديد عند الوكيل") : reply(V.stuck[0]!));

  const first = intents[0]!;

  // البدء الصريح: الرابط (ولو سبق، يُعاد لأنه طلبه).
  if (first === "start" || intents.includes("start")) {
    const text = linkEver ? (pick(V.start.slice(1)) ?? V.start[1]!) : (pick(V.start) ?? V.start[0]!);
    return reply(text, true);
  }
  if (first === "later") return pick(V.later) ? reply(pick(V.later)!) : stuck();
  if (first === "thanks") return reply(pick(V.thanks) ?? V.thanks[0]!);
  if (first === "trust") {
    const text = pick(V.trust);
    return text ? reply(text) : reply(V.trust[1]!, false, "يسأل عن الثقة والضمان أكثر من مرة");
  }

  if (first === "price" || intents.includes("price")) {
    const text = pick(V.price);
    // السعر قيل مرتين: لا نكرره؛ نعرض الرابط إن لم يصله، وإلا نسأل عما يحتاجه.
    if (!text) return linkEver ? stuck() : reply(V.start[0]!, true);
    // بعد ذكر السعر لأول مرة لا نرسل الزر فوراً (نترك له القرار)؛ في المرة الثانية نعرض الاستمارة.
    return reply(text, !linkEver && used.has(norm(V.price[0]!)));
  }

  // أسئلة محددة تُجاب من حقائق المنتج الصحيحة فقط (لا أمثلة مخترعة ولا مواعيد محددة).
  if (first === "nonProduct") return reply(pick(V.nonProduct) ?? V.nonProduct[0]!);
  for (const topic of ["shipping", "payment", "timing", "domain", "example", "why"] as const) {
    if (first === topic) {
      const text = pick(V[topic]);
      return text ? reply(text) : stuck();
    }
  }

  if (first === "details") {
    const text = pick(V.details);
    return text ? reply(text) : stuck();
  }

  if (first === "business") {
    if (!linkEver) return reply(V.business[0]!, true);
    const more = pick(V.details);
    return more ? reply(more) : stuck();
  }

  if (first === "greeting") {
    if (!spoke) return reply(pick(V.greetingFirst) ?? V.greetingFirst[0]!);
    const again = pick(V.greetingAgain);
    return again ? reply(again) : stuck();
  }

  // غير مفهوم: سؤال واحد قصير، ثم عرض التحويل لموظف بدل تكرار السؤال.
  if (!spoke) return reply(V.unclearFirst[0]!);
  const ask = pick(V.unclearAgain);
  return ask ? reply(ask) : stuck();
}
