// fallback-copy.ts — نصوص متجر احترافية حين يتعذر كاتب الذكاء الاصطناعي (مزوّد متوقف، مهلة، رد مشوّه).
// القاعدة: كل جملة إما صياغة لبيانات المتجر الحقيقية (أقسامه، منتجاته، أسعاره، حقائق سياسته)، أو وصف عام صادق
// لنوع النشاط بلا أي رقم أو حدث أو ادعاء غير مثبت. الأسئلة الشائعة تُجاب من الحقائق حرفياً، ولا يُسأل عما ليس فيها.
import type { StoreFact } from "@/blueprint/facts";

type Titled = { eyebrow?: string; title?: string; subtitle?: string };
export type FallbackInput = {
  name: string;
  industry: string;
  founderStory?: string;
  positioning?: string;
  products: { name: string; price?: number; category?: string; bestSeller?: boolean }[];
  stats: { productCount: number; categories: string[]; priceMin: number; priceMax: number; onSale: number };
  facts: StoreFact[];
};

type Kit = {
  eyebrow: string;
  /** {cat} أول قسم أو وصف النشاط. */
  headline: string[];
  promise: string;
  tagline: string;
  sections: { featured: Titled; bestSellers: Titled; categories: Titled; newArrivals: Titled; onSale: Titled; faq: Titled; reviews: Titled; story: Titled; spotlight: Titled };
  philosophy: { title: string; body: string; quote: string };
  productFaq?: { q: string; a: string };
};

const KITS: Record<string, Kit> = {
  fashion: {
    eyebrow: "تشكيلة مختارة",
    headline: ["إطلالتك تبدأ من {cat}", "{cat} بتفاصيل تفرق معاك"],
    promise: "قطع مختارة بعناية لكل يوم ولكل مناسبة",
    tagline: "أزياء تختارها بثقة",
    sections: {
      featured: { eyebrow: "اختيارنا لك", title: "قطع تستحق مكانها في دولابك", subtitle: "اخترناها لك من التشكيلة لتبدأ بها" },
      bestSellers: { eyebrow: "الأكثر طلباً", title: "اللي الكل بيطلبه", subtitle: "القطع الأكثر طلباً عندنا" },
      categories: { eyebrow: "تسوّق حسب القسم", title: "اختار ستايلك", subtitle: "كل قسم بتشكيلته" },
      newArrivals: { eyebrow: "جديد", title: "وصل حديثاً", subtitle: "آخر ما أضفناه للتشكيلة" },
      onSale: { eyebrow: "عروض", title: "أسعار أقل لفترة", subtitle: "قطع عليها خصم الآن" },
      faq: { eyebrow: "قبل ما تطلب", title: "إجابات تهمك", subtitle: "كل اللي محتاج تعرفه عن الطلب والتوصيل" },
      reviews: { eyebrow: "من عملائنا", title: "قالوا عنا", subtitle: "تقييمات حقيقية من طلبات فعلية" },
      story: { eyebrow: "عنا", title: "ليه تختارنا" },
      spotlight: { eyebrow: "قطعة مميزة", title: "اختيار يستحق نظرة" },
    },
    philosophy: {
      title: "نختار القطعة كأننا هنلبسها",
      body: "كل قطعة في المتجر اخترناها بعين العميل: خامة مريحة، وقصة مناسبة، وتفاصيل تفرق في الشكل النهائي. نعرض لك صوراً وأوصافاً واضحة ومقاسات مكتوبة، علشان تطلب وانت عارف هتستلم إيه بالظبط.",
      quote: "الإطلالة الحلوة تبدأ من اختيار صح.",
    },
    productFaq: { q: "أعرف مقاسي إزاي؟", a: "المقاسات المتاحة مكتوبة في صفحة كل منتج. ولو محتار بين مقاسين، اسألنا قبل الطلب ونساعدك تختار." },
  },
  beauty: {
    eyebrow: "عناية تستحقها",
    headline: ["{cat} تهتم بيك كل يوم", "اختيارات {cat} لروتينك"],
    promise: "منتجات عناية وجمال مختارة لروتينك اليومي",
    tagline: "جمالك يستاهل اختيار صح",
    sections: {
      featured: { eyebrow: "اختيارنا لك", title: "أساسيات روتينك", subtitle: "منتجات اخترناها لتبدأ بها" },
      bestSellers: { eyebrow: "الأكثر طلباً", title: "الأكثر طلباً", subtitle: "الأكثر طلباً عندنا" },
      categories: { eyebrow: "تسوّق حسب الاحتياج", title: "لكل احتياج قسمه", subtitle: "اختار القسم اللي يناسبك" },
      newArrivals: { eyebrow: "جديد", title: "وصل حديثاً", subtitle: "آخر الإضافات للمتجر" },
      onSale: { eyebrow: "عروض", title: "عروض العناية", subtitle: "منتجات عليها خصم الآن" },
      faq: { eyebrow: "قبل ما تطلب", title: "أسئلة بتتكرر", subtitle: "عن الطلب والدفع والتوصيل" },
      reviews: { eyebrow: "من عملائنا", title: "تجارب حقيقية", subtitle: "تقييمات من طلبات فعلية" },
      story: { eyebrow: "عنا", title: "ليه تثق فينا" },
      spotlight: { eyebrow: "منتج مميز", title: "يستاهل يكون في روتينك" },
    },
    philosophy: {
      title: "روتين بسيط بنتيجة تفرق",
      body: "نؤمن إن العناية مش لازم تكون معقدة. اخترنا منتجاتنا علشان تناسب الاستخدام اليومي، ونكتب لكل منتج وصفاً واضحاً بطريقة استخدامه، علشان تختار اللي يناسبك وانت مطمئن.",
      quote: "اهتمامك بنفسك يبدأ من اختيار صح.",
    },
    productFaq: { q: "أعرف المنتج المناسب ليا إزاي؟", a: "وصف كل منتج وطريقة استخدامه في صفحته. ولو محتاج ترشيح، ابعتلنا قبل الطلب ونساعدك." },
  },
  electronics: {
    eyebrow: "تقنية تعتمد عليها",
    headline: ["{cat} تشتغل معاك كل يوم", "{cat} مختارة بعناية لأجهزتك"],
    promise: "إكسسوارات وأجهزة مختارة تعتمد عليها في يومك",
    tagline: "اختيارات تقنية تعتمد عليها",
    sections: {
      featured: { eyebrow: "اختيارنا لك", title: "أساسيات لا غنى عنها", subtitle: "منتجات اخترناها لأجهزتك" },
      bestSellers: { eyebrow: "الأكثر طلباً", title: "الأكثر طلباً عندنا", subtitle: "أكثر ما يُطلب في المتجر" },
      categories: { eyebrow: "تسوّق حسب القسم", title: "كل اللي جهازك محتاجه", subtitle: "اختار القسم وابدأ" },
      newArrivals: { eyebrow: "جديد", title: "وصل حديثاً", subtitle: "آخر الإضافات للمتجر" },
      onSale: { eyebrow: "عروض", title: "عروض الأجهزة والإكسسوارات", subtitle: "منتجات عليها خصم الآن" },
      faq: { eyebrow: "قبل ما تطلب", title: "أسئلة بتتكرر", subtitle: "عن الطلب والدفع والتوصيل" },
      reviews: { eyebrow: "من عملائنا", title: "تجارب حقيقية", subtitle: "تقييمات من طلبات فعلية" },
      story: { eyebrow: "عنا", title: "ليه تشتري مننا" },
      spotlight: { eyebrow: "منتج مميز", title: "يستاهل يكون معاك" },
    },
    philosophy: {
      title: "منتج يشتغل من أول مرة",
      body: "في الإكسسوارات والأجهزة، التفاصيل الصغيرة هي اللي بتفرق: توافق مع جهازك، وخامة تستحمل الاستخدام اليومي. علشان كده نكتب لكل منتج مواصفاته وتوافقه بوضوح، علشان تطلب وانت عارف هتستلم إيه.",
      quote: "اختار مرة صح، وارتاح كل يوم.",
    },
    productFaq: { q: "أعرف إن المنتج يناسب جهازي إزاي؟", a: "المواصفات والتوافق مكتوبين في صفحة كل منتج. ولو مش متأكد، ابعتلنا موديل جهازك قبل الطلب ونأكدلك." },
  },
  food: {
    eyebrow: "طعم يفرق",
    headline: ["{cat} بطعم يرجّعك تاني", "{cat} طازة لحد بابك"],
    promise: "منتجات طعام مختارة بعناية لبيتك",
    tagline: "طعم حلو واختيار صح",
    sections: {
      featured: { eyebrow: "اختيارنا لك", title: "ابدأ من هنا", subtitle: "أصناف اخترناها لك" },
      bestSellers: { eyebrow: "الأكثر طلباً", title: "الأكثر طلباً", subtitle: "الأكثر طلباً عندنا" },
      categories: { eyebrow: "تسوّق حسب الصنف", title: "اختار اللي نفسك فيه", subtitle: "كل صنف بقسمه" },
      newArrivals: { eyebrow: "جديد", title: "أصناف جديدة", subtitle: "آخر ما أضفناه" },
      onSale: { eyebrow: "عروض", title: "عروض لفترة", subtitle: "أصناف عليها خصم الآن" },
      faq: { eyebrow: "قبل ما تطلب", title: "أسئلة بتتكرر", subtitle: "عن الطلب والدفع والتوصيل" },
      reviews: { eyebrow: "من عملائنا", title: "قالوا عن طعمنا", subtitle: "تقييمات من طلبات فعلية" },
      story: { eyebrow: "عنا", title: "حكاية الطعم" },
      spotlight: { eyebrow: "صنف مميز", title: "لازم تجربه" },
    },
    philosophy: {
      title: "الطعم الحلو مالوش بديل",
      body: "بنهتم بكل صنف من أول اختياره لحد ما يوصلك. نكتب مكونات وتفاصيل كل منتج بوضوح، علشان تختار اللي يناسبك ويناسب بيتك.",
      quote: "اللي يدوق مرة، يرجع تاني.",
    },
  },
  home: {
    eyebrow: "لبيتك",
    headline: ["{cat} تضيف لبيتك لمسة", "بيتك أحلى مع {cat}"],
    promise: "منتجات للبيت مختارة بعين تحب التفاصيل",
    tagline: "تفاصيل تخلي البيت أحلى",
    sections: {
      featured: { eyebrow: "اختيارنا لك", title: "لمسات تفرق في بيتك", subtitle: "منتجات اخترناها لك" },
      bestSellers: { eyebrow: "الأكثر طلباً", title: "الأكثر طلباً", subtitle: "الأكثر طلباً عندنا" },
      categories: { eyebrow: "تسوّق حسب الركن", title: "لكل ركن في البيت", subtitle: "اختار القسم" },
      newArrivals: { eyebrow: "جديد", title: "وصل حديثاً", subtitle: "آخر الإضافات" },
      onSale: { eyebrow: "عروض", title: "عروض البيت", subtitle: "منتجات عليها خصم الآن" },
      faq: { eyebrow: "قبل ما تطلب", title: "أسئلة بتتكرر", subtitle: "عن الطلب والدفع والتوصيل" },
      reviews: { eyebrow: "من عملائنا", title: "من بيوت عملائنا", subtitle: "تقييمات من طلبات فعلية" },
      story: { eyebrow: "عنا", title: "ليه بنحب اللي بنعمله" },
      spotlight: { eyebrow: "منتج مميز", title: "يستاهل مكان في بيتك" },
    },
    philosophy: {
      title: "البيت يتعمل بالتفاصيل",
      body: "نختار منتجاتنا علشان تكون عملية وشكلها حلو في نفس الوقت. نكتب المقاسات والخامات بوضوح، علشان تعرف المنتج هيناسب مكانه قبل ما تطلبه.",
      quote: "التفاصيل الصغيرة هي اللي بتعمل البيت.",
    },
  },
  kids: {
    eyebrow: "لأطفالك",
    headline: ["{cat} تفرّح أطفالك", "اختيارات {cat} للصغار"],
    promise: "منتجات أطفال مختارة بعناية واهتمام",
    tagline: "لأحلى أطفال",
    sections: {
      featured: { eyebrow: "اختيارنا لك", title: "يحبوها الصغار", subtitle: "منتجات اخترناها لأطفالك" },
      bestSellers: { eyebrow: "الأكثر طلباً", title: "الأكثر طلباً", subtitle: "الأكثر طلباً عندنا" },
      categories: { eyebrow: "تسوّق حسب القسم", title: "لكل عمر احتياجه", subtitle: "اختار القسم" },
      newArrivals: { eyebrow: "جديد", title: "وصل حديثاً", subtitle: "آخر الإضافات" },
      onSale: { eyebrow: "عروض", title: "عروض الأطفال", subtitle: "منتجات عليها خصم الآن" },
      faq: { eyebrow: "قبل ما تطلب", title: "أسئلة بتتكرر", subtitle: "عن الطلب والدفع والتوصيل" },
      reviews: { eyebrow: "من عملائنا", title: "قالوا عنا", subtitle: "تقييمات من طلبات فعلية" },
      story: { eyebrow: "عنا", title: "ليه تختارنا لأطفالك" },
      spotlight: { eyebrow: "منتج مميز", title: "هيحبه طفلك" },
    },
    philosophy: {
      title: "اللي يفرّح طفلك يطمّنك",
      body: "بنختار منتجات الأطفال بعين الأم والأب: راحة وأمان واستخدام عملي. ونكتب الأعمار والمقاسات والخامات بوضوح، علشان تختار وانت مطمئن.",
      quote: "ضحكة طفلك تستاهل.",
    },
    productFaq: { q: "أعرف المقاس أو العمر المناسب إزاي؟", a: "الأعمار والمقاسات مكتوبة في صفحة كل منتج. ولو محتار، اسألنا قبل الطلب ونساعدك." },
  },
  accessories: {
    eyebrow: "تفاصيل تكمّلك",
    headline: ["{cat} تكمّل إطلالتك", "لمسة {cat} تفرق"],
    promise: "إكسسوارات مختارة تكمّل ستايلك",
    tagline: "التفاصيل بتفرق",
    sections: {
      featured: { eyebrow: "اختيارنا لك", title: "قطع تكمّل الإطلالة", subtitle: "اخترناها لك" },
      bestSellers: { eyebrow: "الأكثر طلباً", title: "الأكثر طلباً", subtitle: "اللي الكل بيطلبه" },
      categories: { eyebrow: "تسوّق حسب القسم", title: "اختار لمستك", subtitle: "كل قسم بتشكيلته" },
      newArrivals: { eyebrow: "جديد", title: "وصل حديثاً", subtitle: "آخر الإضافات" },
      onSale: { eyebrow: "عروض", title: "عروض لفترة", subtitle: "قطع عليها خصم الآن" },
      faq: { eyebrow: "قبل ما تطلب", title: "إجابات تهمك", subtitle: "عن الطلب والدفع والتوصيل" },
      reviews: { eyebrow: "من عملائنا", title: "قالوا عنا", subtitle: "تقييمات من طلبات فعلية" },
      story: { eyebrow: "عنا", title: "ليه تختارنا" },
      spotlight: { eyebrow: "قطعة مميزة", title: "تستاهل نظرة" },
    },
    philosophy: {
      title: "الإطلالة بتكمل بالتفاصيل",
      body: "الإكسسوار الصح بيغيّر الإطلالة كلها. علشان كده نختار قطعنا بعناية، ونعرضها بصور ووصف واضح للخامة والمقاس، علشان تختار اللي يشبهك.",
      quote: "لمسة صغيرة، فرق كبير.",
    },
  },
  gifts: {
    eyebrow: "هدايا تفرّح",
    headline: ["هدية تفضل في البال", "{cat} لكل مناسبة"],
    promise: "هدايا مختارة تفرّح اللي بتحبهم",
    tagline: "هدايا تفضل في البال",
    sections: {
      featured: { eyebrow: "اختيارنا لك", title: "هدايا مضمونة", subtitle: "اخترناها لك" },
      bestSellers: { eyebrow: "الأكثر طلباً", title: "الأكثر طلباً", subtitle: "الأكثر طلباً عندنا" },
      categories: { eyebrow: "تسوّق حسب المناسبة", title: "لكل مناسبة هديتها", subtitle: "اختار القسم" },
      newArrivals: { eyebrow: "جديد", title: "وصل حديثاً", subtitle: "آخر الإضافات" },
      onSale: { eyebrow: "عروض", title: "هدايا بأسعار أقل", subtitle: "عليها خصم الآن" },
      faq: { eyebrow: "قبل ما تطلب", title: "أسئلة بتتكرر", subtitle: "عن الطلب والدفع والتوصيل" },
      reviews: { eyebrow: "من عملائنا", title: "فرحة حقيقية", subtitle: "تقييمات من طلبات فعلية" },
      story: { eyebrow: "عنا", title: "ليه بنحب الهدايا" },
      spotlight: { eyebrow: "هدية مميزة", title: "تفرّح من أول نظرة" },
    },
    philosophy: {
      title: "الهدية رسالة",
      body: "بنؤمن إن الهدية الحلوة بتقول اللي الكلام مش بيقوله. علشان كده نختار هدايانا بعناية، ونكتب تفاصيل كل واحدة بوضوح، علشان تختار اللي يناسب المناسبة والشخص.",
      quote: "أحلى هدية هي اللي تفضل في البال.",
    },
  },
  health: {
    eyebrow: "صحتك أولاً",
    headline: ["{cat} لصحة أفضل كل يوم", "اهتم بصحتك مع {cat}"],
    promise: "منتجات صحة وعافية مختارة بعناية",
    tagline: "صحتك تستاهل",
    sections: {
      featured: { eyebrow: "اختيارنا لك", title: "أساسيات صحتك", subtitle: "منتجات اخترناها لك" },
      bestSellers: { eyebrow: "الأكثر طلباً", title: "الأكثر طلباً", subtitle: "أكثر ما يُطلب في المتجر" },
      categories: { eyebrow: "تسوّق حسب الاحتياج", title: "لكل احتياج قسمه", subtitle: "اختار القسم" },
      newArrivals: { eyebrow: "جديد", title: "وصل حديثاً", subtitle: "آخر الإضافات" },
      onSale: { eyebrow: "عروض", title: "عروض لفترة", subtitle: "منتجات عليها خصم الآن" },
      faq: { eyebrow: "قبل ما تطلب", title: "أسئلة بتتكرر", subtitle: "عن الطلب والدفع والتوصيل" },
      reviews: { eyebrow: "من عملائنا", title: "تجارب حقيقية", subtitle: "تقييمات من طلبات فعلية" },
      story: { eyebrow: "عنا", title: "ليه تثق فينا" },
      spotlight: { eyebrow: "منتج مميز", title: "يستاهل يكون في يومك" },
    },
    philosophy: {
      title: "صحتك تستاهل اختيار واضح",
      body: "نكتب لكل منتج مكوناته وطريقة استخدامه بوضوح، علشان تختار وانت فاهم. ولو عندك أي سؤال قبل الطلب، اسألنا.",
      quote: "اهتمامك بصحتك استثمار.",
    },
  },
};

const GENERAL: Kit = {
  eyebrow: "تشكيلة مختارة",
  headline: ["{cat} مختارة بعناية", "كل اللي محتاجه من {cat}"],
  promise: "منتجات مختارة بعناية توصل لحد بابك",
  tagline: "اختيارات تستاهل",
  sections: KITS.accessories!.sections,
  philosophy: {
    title: "نختار علشانك",
    body: "كل منتج في المتجر اخترناه بعناية، ونكتب تفاصيله بوضوح بالصور والوصف والسعر، علشان تطلب وانت عارف هتستلم إيه بالظبط.",
    quote: "الاختيار الصح يوفّر عليك كتير.",
  },
};

const GENERIC_CATS = /^(منتجاتنا|المنتجات|كل المنتجات|منتجات|عام|أخرى|اخرى|متنوع|متنوعة)$/;
const fill = (s: string, cat: string) => s.replace(/\{cat\}/g, cat);
const egp = (n: number) => `${Math.round(n).toLocaleString("en-US")} ج`;

/** أسئلة يجاب عنها من حقائق المتجر حرفياً (ولا سؤال عن حقيقة غير موجودة). */
function factFaq(facts: StoreFact[], storeName: string): { q: string; a: string }[] {
  const by = new Map(facts.map((f) => [f.key, f] as const));
  const out: { q: string; a: string }[] = [];
  const pay = [by.get("cod")?.title, by.get("wallets")?.title].filter(Boolean) as string[];
  out.push({
    q: "أطلب إزاي؟",
    a: `اختار المنتج وأضفه للسلة، وبعدين اكتب اسمك ورقمك وعنوانك في صفحة إتمام الطلب. ${pay.length ? `ومتاح لك ${pay.join(" و")}.` : ""} وهيوصلك تأكيد برقم طلبك تتابعه منه.`.replace(/\s+/g, " ").trim(),
  });
  if (by.get("cod") || by.get("wallets")) out.push({ q: "طرق الدفع المتاحة إيه؟", a: [by.get("cod")?.detail, by.get("wallets")?.detail].filter(Boolean).join("، أو ") + "." });
  const ship = [by.get("nationwide")?.detail, by.get("fast_delivery")?.detail, by.get("free_shipping")?.detail ?? by.get("free_shipping_over")?.detail].filter(Boolean);
  if (ship.length) out.push({ q: "التوصيل عامل إزاي؟", a: ship.join(". ") + "." });
  if (by.get("inspection")) out.push({ q: "أقدر أعاين المنتج قبل ما أدفع؟", a: `أيوه، ${by.get("inspection")!.detail}.` });
  if (by.get("returns")) out.push({ q: "أقدر أستبدل أو أرجّع؟", a: `${by.get("returns")!.detail}.` });
  if (by.get("defect")) out.push({ q: "لو المنتج وصل فيه عيب؟", a: `${by.get("defect")!.detail}.` });
  if (by.get("pickup")) out.push({ q: "أقدر أستلم بنفسي؟", a: `${by.get("pickup")!.detail}.` });
  if (by.get("whatsapp")) out.push({ q: `أتواصل مع ${storeName} إزاي؟`, a: `${by.get("whatsapp")!.detail}.` });
  return out;
}

export function fallbackCopy(b: FallbackInput) {
  const kit = KITS[b.industry] ?? GENERAL;
  // أسماء عامة من الخطة الافتراضية ليست أقساماً حقيقية تصلح للعناوين.
  const cats = b.stats.categories.filter((c) => c && !GENERIC_CATS.test(c.trim()));
  const cat = cats[0];
  // اختيار ثابت للمتجر نفسه (لا يتغير بين بناءين لنفس الاسم).
  const pick = <T,>(arr: T[]) => arr[[...b.name].reduce((a, c) => a + c.charCodeAt(0), 0) % arr.length]!;
  const strongest = b.facts.find((f) => f.key === "inspection") ?? b.facts.find((f) => f.key === "cod") ?? b.facts[0];
  const range =
    b.stats.priceMin > 0 && b.stats.priceMax > b.stats.priceMin
      ? `من ${egp(b.stats.priceMin)} إلى ${egp(b.stats.priceMax)}`
      : b.stats.priceMin > 0
        ? `بسعر ${egp(b.stats.priceMin)}`
        : "";
  const catLine = cats.length > 1 ? `${cats.slice(0, -1).slice(0, 3).join("، ")} و${cats[Math.min(cats.length, 4) - 1]}` : cats[0] ?? "";

  const subheadline = [
    `${kit.promise}${catLine ? `: ${catLine}` : ""}.`,
    strongest ? `${strongest.detail}.` : "",
  ]
    .join(" ")
    .trim();

  const faq = [...factFaq(b.facts, b.name), ...(kit.productFaq ? [kit.productFaq] : [])].slice(0, 6);

  const story = b.founderStory
    ? { title: `حكاية ${b.name}`, body: b.founderStory, quote: kit.philosophy.quote }
    : {
        title: kit.philosophy.title,
        body: `${kit.philosophy.body}${b.stats.productCount > 1 && range.startsWith("من") ? ` واختياراتنا ${range}، لتلاقي اللي يناسبك.` : ""}`,
        quote: kit.philosophy.quote,
      };

  return {
    brandTagline: kit.tagline,
    hero: {
      eyebrow: kit.eyebrow,
      headline: (cat ? fill(pick(kit.headline), cat) : kit.tagline).slice(0, 80),
      subheadline: subheadline.slice(0, 200),
      primaryCta: "تسوّق الآن",
      secondaryCta: cats.length > 1 ? "تصفّح الأقسام" : undefined,
    },
    announcements: b.facts.slice(0, 4).map((f) => ({ fact: f.key, text: f.title })),
    trust: b.facts.slice(0, 4).map((f) => ({ fact: f.key, title: f.title, text: f.detail, icon: f.icon })),
    sections: kit.sections,
    story,
    faq,
    footerTagline: `${b.name}: ${kit.promise}.`.slice(0, 150),
    seo: {
      title: `${b.name}${cats[0] ? ` | ${cats[0]}` : ""}`.slice(0, 65),
      description: `${b.name}: ${kit.promise}${catLine ? ` (${catLine})` : ""}.${strongest ? ` ${strongest.title}.` : ""}`.slice(0, 155),
    },
  };
}
