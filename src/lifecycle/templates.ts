// templates.ts — رسائل دورة حياة المتجر (البوت والبريد). المالك يعدّلها من لوحته (message_templates)، وهذه القيم الافتراضية.
// نموذج الأسعار v3 (V2-PLAN 3.4): باقات 3 و6 و12 شهراً (البناء + المدة)، ثم تجديد بمدة يختارها التاجر. لا «مدى الحياة».
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { messageTemplates } from "@/db/schema";
import { clientEnv, env } from "@/lib/env";
import { currentPricing } from "@/server/pricing";
import { monthsLabel, startingPrice } from "@/lib/platform-pricing";
import { stripEmoji } from "@/lib/emoji";
import { sendTemplatedEmail } from "@/lib/email";

type Def = { label: string; vars: readonly string[]; body: string };

export const TEMPLATE_DEFAULTS = {
  // ── إعداد المتجر (بعد أن يجهّزه الوكيل ويصل صاحبه رابط الإعداد) ──
  "setup.link": {
    label: "رابط إعداد المتجر",
    vars: ["store", "setup_url"],
    body: "أهلاً بكم. متجر «{{store}}» أصبح جاهزاً للإعداد.\nادخلوا بحساب Google بنفس البريد الذي زوّدتمونا به، ثم أكملوا الإعداد خطوة بعد خطوة (نحو عشر دقائق): المنتجات، وسائل الدفع، الشحن، والتواصل. يُحفظ تقدمكم تلقائياً، ويمكنكم الإكمال لاحقاً من حيث توقفتم.\nبعد التفعيل تبدأ تجربة مجانية قبل أي دفع، وكل شيء قابل للتعديل من لوحة التحكم.\nرابط الإعداد: {{setup_url}}",
  },
  "setup.reminder_24h": {
    label: "تذكير إكمال الإعداد (بعد 24 ساعة)",
    vars: ["store", "setup_url"],
    body: "متجر «{{store}}» جاهز وبانتظاركم. الإعداد يستغرق نحو عشر دقائق ويُحفظ تقدمكم بعد كل خطوة.\nأكملوا الإعداد من هنا: {{setup_url}}",
  },
  "setup.reminder_72h": {
    label: "تذكير أخير بإكمال الإعداد (بعد 72 ساعة)",
    vars: ["store", "setup_url"],
    body: "ما زال متجر «{{store}}» بانتظار إكمال إعداده. إن لم يكتمل خلال الأيام القادمة فسنحذف المتجر غير المكتمل تلقائياً لنُفسح المجال لغيره، ويمكنكم دائماً مراسلتنا لنبدأ من جديد.\nنحتاج منكم عشر دقائق فقط: {{setup_url}}",
  },
  "setup.purged": {
    label: "حذف متجر لم يكتمل إعداده",
    vars: ["store"],
    body: "انتهت مهلة إعداد متجر «{{store}}» فحذفنا المتجر غير المكتمل. يسعدنا أن نبدأ معكم من جديد في أي وقت: راسلونا هنا وسنجهّز لكم متجراً جديداً.",
  },

  // ── التسليم والتجربة ──
  "delivery.welcome": {
    label: "رسالة تفعيل المتجر وبدء التجربة",
    vars: ["store", "store_url", "magic_url", "trial_hours"],
    body: "مبروك، متجر {{store}} جاهز للعمل.\nرابط المتجر: {{store_url}}\nلوحة التحكم: {{magic_url}}\nأمامكم {{trial_hours}} ساعة تجربة مجانية: اطلبوا من المتجر كما يفعل زبائنكم، وعدّلوا المنتجات والأسعار من اللوحة، وإن احتجتم إلى أي مساعدة راسلونا هنا.",
  },
  "delivery.guide": {
    label: "توجيه ما بعد التفعيل",
    vars: [],
    body: "أسرع طريقة لتعرّف المتجر: افتحوا رابطه واطلبوا منتجاً كما يفعل الزبون. يظهر الطلب في اللوحة بوصفه «تجريبياً»، فلا يخصم من المخزون ولا يُحسب في المبيعات. ومن صفحته تطبعون الفاتورة وتجهّزون رسالة واتساب للزبون.",
  },
  "trial.ideas": {
    label: "أفكار لتجربة المتجر (منتصف التجربة)",
    vars: ["store", "products", "tip", "facts_line"],
    body: "أفكار لتجربة متجر {{store}} (فيه الآن {{products}} منتج): {{tip}}{{facts_line}}\nإن أردتم أي تعديل على الشكل أو المنتجات، راسلونا وسنساعدكم.",
  },
  "trial.pay": {
    label: "تذكير الدفع قبل نهاية التجربة",
    vars: ["store", "ends", "facts_line", "price", "plans"],
    body: "تنتهي تجربة متجر {{store}} {{ends}}.{{facts_line}}\nليبقى متاحاً لزبائنكم بالرابط نفسه، اختاروا الباقة المناسبة: {{plans}}. كل باقة تشمل الاستضافة والتشغيل والتحديثات طوال مدتها، وبلا عمولة على المبيعات.\nالتحويل ورفع الإيصال من هنا:",
  },
  "trial.freeze": {
    label: "انتهاء التجربة وإيقاف المتجر مؤقتاً",
    vars: ["store", "facts_line", "products", "purge_day", "price"],
    body: "انتهت تجربة متجر {{store}} وأوقفناه مؤقتاً عن الزوار.{{facts_line}}\nكل شيء محفوظ كما هو ({{products}} منتج، والتصميم، والإعدادات) حتى {{purge_day}}، وبعدها يُحذف نهائياً. بمجرد الدفع قبل ذلك يعود المتجر فوراً بالرابط نفسه. الباقات تبدأ من {{price}} ج شاملة الاستضافة والتشغيل.",
  },
  "trial.last_chance": {
    label: "تنبيه أخير قبل الحذف",
    vars: ["store", "when", "price"],
    body: "تنبيه أخير قبل حذف متجر {{store}} نهائياً ({{when}}). بعد الحذف لا يمكننا استرجاع التصميم ولا المنتجات. للاحتفاظ بمتجركم، فعّلوه بأي باقة (تبدأ من {{price}} ج) من هنا:",
  },
  "doom.deleted": {
    label: "بعد الحذف النهائي",
    vars: ["store"],
    body: "انتهت المهلة وحُذف متجر {{store}} وبياناته. يسعدنا أن نجهّز لكم متجراً جديداً في أي وقت: راسلونا هنا ونبدأ من جديد.",
  },

  // ── الدفع ──
  "payment.invite": {
    label: "دعوة لتفعيل المتجر (الباقات)",
    vars: ["store", "price", "plans", "vodafone", "instapay", "activate_url"],
    body: "هل أعجبكم متجر {{store}}؟ لفتحه لزبائنكم واستقبال طلبات حقيقية اختاروا الباقة المناسبة: {{plans}}. كل باقة تشمل المتجر نفسه والاستضافة والتشغيل والتحديثات طوال مدتها، وبلا عمولة على المبيعات.\nفودافون كاش: {{vodafone}}\nإنستاباي: {{instapay}}\nبعد التحويل ارفعوا صورة الإيصال من هنا: {{activate_url}}\nنراجع الإيصال بأنفسنا، وفور قبوله يُفعَّل المتجر ويصلكم بريد بذلك.",
  },
  "payment.received": {
    label: "استلام الإيصال",
    vars: ["store"],
    body: "وصلنا إيصال الدفع لمتجر {{store}} وهو الآن قيد المراجعة. نراجع الإيصالات بأنفسنا، وسيصلكم تأكيد بمجرد اعتماده.",
  },
  "payment.confirmed": {
    label: "تأكيد الدفع وتفعيل المتجر",
    vars: ["store", "store_url", "expires", "months"],
    body: "تم تأكيد الدفع، ومتجر {{store}} مفعّل الآن ومفتوح لزبائنكم. باقة {{months}} سارية حتى {{expires}}، وبلا أي عمولة على المبيعات.\nرابط المتجر: {{store_url}}\nلأي تعديل تحتاجونه راسلونا هنا أو اطلبوه من «طلبات التعديل» في لوحة التحكم.",
  },
  "payment.golden": {
    label: "تأكيد دفع «الدائرة الذهبية»",
    vars: ["store", "store_url", "expires", "months"],
    body: "تم تأكيد الدفع، ومتجر {{store}} مفعّل الآن ضمن «الدائرة الذهبية». المبلغ يغطي تكلفة استضافة {{months}} فقط، وتجهيز المتجر بلا مقابل، والاستضافة سارية حتى {{expires}}. بعدها يمكنكم التجديد بأي باقة عادية.\nرابط المتجر: {{store_url}}\nالخطوة المتبقية: منشور مشترك (Collab) على إنستجرام بيننا وبينكم عن المتجر، ومونتاجه علينا مجاناً، أو رأي مكتوب نشاركه بعد موافقتكم على صياغته إن لم يناسبكم المنشور. سنتواصل معكم لترتيب الموعد.",
  },
  "payment.rejected": {
    label: "تعذّر تأكيد الدفع",
    vars: ["store", "hours", "reason_line", "vodafone", "instapay", "activate_url"],
    body: "راجعنا إيصال التحويل ولم نتمكن من تأكيده.{{reason_line}}\nمتجر {{store}} محفوظ لكم لمدة {{hours}} ساعة. إن تم التحويل فعلاً، ارفعوا الإيصال الصحيح من هنا: {{activate_url}}\nفودافون كاش: {{vodafone}}\nإنستاباي: {{instapay}}",
  },
  "doom.reminder_12h": {
    label: "تذكير قبل الحذف بـ 12 ساعة",
    vars: ["store", "price", "activate_url"],
    body: "تبقّت 12 ساعة على انتهاء مهلة حفظ متجر {{store}}. لتفعيله اختاروا باقة (تبدأ من {{price}} ج شاملة التجهيز والاستضافة) وارفعوا إثبات الدفع من هنا: {{activate_url}}",
  },
  "doom.reminder_1h": {
    label: "تذكير قبل الحذف بساعة",
    vars: ["store", "activate_url"],
    body: "تبقّت ساعة واحدة على انتهاء مهلة متجر {{store}}، وبعدها يُحذف نهائياً. لتفعيله الآن: {{activate_url}}",
  },

  // ── التجديد ──
  "hosting.reminder": {
    label: "تذكير بقرب انتهاء الاشتراك (30 و7 و1 يوم)",
    vars: ["store", "when", "expires", "plans", "renewal"],
    body: "تنبيه: اشتراك متجر {{store}} ينتهي {{when}} ({{expires}}).\nيمكنكم التجديد بالمدة التي تناسبكم: {{plans}}. وتُضاف المدة إلى نهاية الاشتراك الحالي فلا يضيع أي يوم. المتجر وبياناته كما هي دائماً.",
  },
  "hosting.expired": {
    label: "انتهاء الاشتراك وبدء فترة السماح",
    vars: ["store", "pause_day", "plans"],
    body: "انتهى اشتراك متجر {{store}}. يستمر المتجر في العمل كالمعتاد حتى {{pause_day}}، ثم يتوقف عن الظهور للزوار حتى التجديد.\nالتجديد من صفحة الدفع بالمدة التي تناسبكم: {{plans}}. ولا يُحذف أي شيء من بياناتكم.",
  },
  "hosting.paused": {
    label: "توقف المتجر مؤقتاً بعد السماح",
    vars: ["store", "plans"],
    body: "توقف متجر {{store}} مؤقتاً عن الظهور للزوار لانتهاء الاشتراك. لم يُحذف أي شيء: المنتجات والطلبات والعملاء والتصميم محفوظة كما هي. وبمجرد التجديد ({{plans}}) يعود المتجر فوراً بالرابط نفسه.",
  },
  "hosting.renewed": {
    label: "تأكيد تجديد الاستضافة",
    vars: ["store", "store_url", "expires", "months"],
    body: "تم تجديد استضافة متجر {{store}} لمدة {{months}}، وهي سارية الآن حتى {{expires}}. شكراً لثقتكم.\nرابط المتجر: {{store_url}}",
  },
  "hosting.renewal_revoked": {
    label: "إلغاء تجديد بعد المراجعة",
    vars: ["store", "expires", "reason_line", "activate_url"],
    body: "راجعنا إيصال تجديد متجر {{store}} ولم نتمكن من تأكيده، فأُلغي التجديد.{{reason_line}}\nالاشتراك الحالي يبقى سارياً حتى {{expires}} ولم يتغير شيء في متجركم. إن تم التحويل فعلاً، ارفعوا الإيصال الصحيح من هنا: {{activate_url}}",
  },
} as const satisfies Record<string, Def>;

export type TemplateKey = keyof typeof TEMPLATE_DEFAULTS;

export async function getTemplateBody(key: TemplateKey): Promise<string> {
  try {
    const [row] = await db
      .select({ content: messageTemplates.content })
      .from(messageTemplates)
      .where(eq(messageTemplates.key, key))
      .limit(1);
    if (row?.content?.trim()) return row.content;
  } catch (e) {
    console.error("[templates] db read failed, using default", key, e);
  }
  return TEMPLATE_DEFAULTS[key].body;
}

export async function renderTemplate(
  key: TemplateKey,
  vars: Record<string, string | number | undefined> = {}
) {
  const body = await getTemplateBody(key);
  const missing: string[] = [];
  const text = body.replace(
    /\{\{\s*([a-z0-9_]+)\s*\}\}/gi,
    (_, name: string) => {
      const v = vars[name];
      if (v === undefined || v === null || v === "") {
        missing.push(name);
        return "";
      }
      return String(v);
    }
  );
  return {
    text: stripEmoji(text).replace(/[ \t]{2,}/g, " ").trim(),
    missing: Array.from(new Set(missing)),
  };
}

/** صفحة الدفع على المنصة: كل رسالة تدعو للدفع تشير إليها (صفحة /admin/activate في المتجر تحوّل إليها). */
export const billingUrl = () => `${clientEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/dashboard/billing`;

const egp = (n: number) => n.toLocaleString("en-US");

/** سطر الباقات للرسائل: «3 أشهر بـ 1,999 ج، 6 أشهر بـ 2,499 ج، سنة بـ 3,499 ج». */
export function plansLine(plans: { months: number; price: number }[]): string {
  return plans.map((p) => `${monthsLabel(p.months)} بـ ${egp(p.price)} ج`).join("، ");
}

/** متغيرات رسائل الدفع: أرخص باقة وسطر كل الباقات من الأسعار الحالية. */
export async function paymentVars(store: { name: string }, activateUrl: string = billingUrl()) {
  const p = await currentPricing();
  return {
    store: store.name,
    price: egp(startingPrice(p)),
    plans: plansLine(p.plans),
    vodafone: env.VODAFONE_CASH_NUMBER,
    instapay: env.INSTAPAY_NUMBER,
    activate_url: activateUrl,
  };
}

/** تاريخ يوم بالعربية (أرقام لاتينية، بتوقيت القاهرة): «الأحد 12 أكتوبر 2027». */
export function formatDay(d: Date): string {
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Cairo" }).format(d);
}

/**
 * إصلاح نوع الإرجاع: Promise<boolean> لتطابق واجهة sendTemplatedEmail.
 */
export async function sendEmailFromTemplate(
  key: TemplateKey,
  to: string | string[],
  vars: Record<string, string | number | undefined> = {},
  options?: {
    subject?: string;
    idempotencyKey?: string;
    replyTo?: string;
    storeName?: string;
    buttons?: { title: string; url: string }[];
  }
): Promise<boolean> {
  const { text, missing } = await renderTemplate(key, vars);
  if (missing.length) {
    console.warn(`[templates] email "${key}" missing vars:`, missing);
  }

  const subjectFromKey =
    options?.subject ??
    ({
      "setup.link": `متجر ${vars.store ?? ""} جاهز للإعداد`,
      "setup.reminder_24h": `متجر ${vars.store ?? ""} ينتظر إكمال الإعداد`,
      "setup.reminder_72h": `تذكير أخير بإعداد متجر ${vars.store ?? ""}`,
      "setup.purged": `حُذف متجر ${vars.store ?? ""} غير المكتمل`,
      "delivery.welcome": `متجركم جاهز — ${vars.store ?? ""}`,
      "payment.received": `وصلنا إيصال الدفع — ${vars.store ?? ""}`,
      "payment.confirmed": `تم تفعيل متجركم — ${vars.store ?? ""}`,
      "hosting.renewed": `تم تجديد الاستضافة — ${vars.store ?? ""}`,
      "hosting.renewal_revoked": `بخصوص تجديد متجركم — ${vars.store ?? ""}`,
      "payment.golden": `تم تفعيل متجركم في الدائرة الذهبية — ${vars.store ?? ""}`,
      "payment.rejected": `تعذّر تأكيد الدفع — ${vars.store ?? ""}`,
    } as Record<string, string>)[key as string] ??
    TEMPLATE_DEFAULTS[key].label;

  const { GenericEmail } = await import(
    "./../lib/email-templates/GenericEmail"
  );

  const r = await sendTemplatedEmail({
    to,
    subject: subjectFromKey,
    element: GenericEmail({
      storeName: options?.storeName ?? "Colapia",
      headline: TEMPLATE_DEFAULTS[key].label,
      paragraphs: text.split(/\n+/).filter(Boolean),
      buttons: options?.buttons,
    }),
    idempotencyKey: options?.idempotencyKey,
    replyTo: options?.replyTo,
    preheader: text.slice(0, 120),
  });

  return r.ok;
}