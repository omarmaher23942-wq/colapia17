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
  "link.issued": {
    label: "إرسال رابط الاستمارة",
    vars: [],
    body: "تمام، ده رابط استمارة متجركم السريعة: دقيقتين تقريباً لبيانات المتجر وصور المنتجات، وبعدها فريق Colapia يبدأ التنفيذ ويبلّغكم بالموعد.",
  },
  "link.reissued": {
    label: "تجديد رابط الاستمارة",
    vars: [],
    body: "ده الرابط الجديد، وكل اللي اتكتب قبل كده محفوظ ويكمل من مكانه.",
  },
  "form.received": {
    label: "استلام الاستمارة",
    vars: ["name"],
    body: "وصلتنا استمارة {{name}} بنجاح! فريقنا هيبدأ شغل المتجر، وهنبلّغكم هنا بكل مرحلة وبالموعد المتوقع.",
  },
  "delivery.welcome": {
    label: "رسالة تسليم المتجر",
    vars: ["store", "store_url", "magic_url", "trial_hours"],
    body: "مبروك! فريق Colapia خلّص متجر {{store}} وراجعه.\nرابط المتجر: {{store_url}}\nلوحة التحكم: {{magic_url}}\nقدامكم {{trial_hours}} ساعة تجربة مجانية: اطلبوا منه كأنكم عملاء، وعدّلوا المنتجات والأسعار، ولو في أي تعديل ردّوا علينا هنا.",
  },
  "delivery.guide": {
    label: "توجيه ما بعد التسليم",
    vars: [],
    body: "أسرع طريقة تعرفوا بيها المتجر: افتحوا رابطه واطلبوا منتج كأنكم عملاء. الطلب يظهر في اللوحة «تجريبي» (لا يخصم من المخزون ولا يُحسب في المبيعات)، ومنه تطبعوا الفاتورة وتبعتوا للعميل رسالة واتساب جاهزة.",
  },
  "payment.invite": {
    label: "دعوة لتفعيل المتجر (الباقة)",
    vars: ["store", "price", "plans", "vodafone", "instapay", "activate_url"],
    body: "هل أعجبكم متجر {{store}}؟ ليفتح لعملائكم ويستقبل طلبات حقيقية، اختاروا الباقة المناسبة: {{plans}}. كل باقة تشمل المتجر نفسه والاستضافة والتشغيل والتحديثات طوال مدتها، بلا أي عمولة على المبيعات.\nفودافون كاش: {{vodafone}}\nإنستاباي: {{instapay}}\nبعد التحويل ارفعوا صورة الإيصال من هنا: {{activate_url}}\nنراجع الإيصال بأنفسنا، وفور قبوله يُفعَّل المتجر ويصلكم بريد بذلك.",
  },
  "payment.confirmed": {
    label: "تأكيد الدفع وتفعيل المتجر",
    vars: ["store", "store_url", "expires", "months"],
    body: "تم تأكيد الدفع، ومتجر {{store}} مفعّل الآن ومفتوح لعملائكم. باقة {{months}} سارية حتى {{expires}}، بلا أي عمولة على المبيعات.\nرابط المتجر: {{store_url}}\nلأي تعديل تحتاجونه: ردّوا علينا هنا أو اطلبوه من «طلبات التعديل» في لوحة التحكم.",
  },
  "payment.golden": {
    label: "تأكيد دفع «الدائرة الذهبية»",
    vars: ["store", "store_url", "expires", "months"],
    body: "تم تأكيد الدفع، ومتجر {{store}} مفعّل الآن ضمن «الدائرة الذهبية». المبلغ الذي دفعتموه يغطي تكلفة استضافة {{months}} فقط، والبناء مجاني، والاستضافة سارية حتى {{expires}}. بعدها يمكنكم التجديد بأي باقة عادية.\nرابط المتجر: {{store_url}}\nالخطوة المتبقية: بوست Collab على إنستجرام بيننا وبينكم عن المتجر (والمونتاج علينا مجاناً)، أو رسالة رأي نشاركها إن لم يناسبكم البوست.",
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
  "payment.rejected": {
    label: "رفض الدفع",
    vars: ["store", "hours", "reason_line", "vodafone", "instapay", "activate_url"],
    body: "راجعنا إيصال التحويل ولم نتمكن من تأكيده.{{reason_line}}\nمتجر {{store}} محفوظ لكم لمدة {{hours}} ساعة. إن تم التحويل، ارفعوا الإيصال الصحيح من هنا: {{activate_url}}\nفودافون كاش: {{vodafone}}\nإنستاباي: {{instapay}}",
  },
  "doom.reminder_12h": {
    label: "تذكير قبل المسح بـ 12 ساعة",
    vars: ["store", "price", "activate_url"],
    body: "باقٍ 12 ساعة على انتهاء مهلة حفظ متجر {{store}}. لتفعيله اختاروا باقة (تبدأ من {{price}} ج شاملة البناء والاستضافة) وارفعوا إثبات الدفع من هنا: {{activate_url}}",
  },
  "doom.reminder_1h": {
    label: "تذكير قبل المسح بساعة",
    vars: ["store", "activate_url"],
    body: "فاضل ساعة واحدة على انتهاء مهلة متجر {{store}} وبعدها هيتم مسحه نهائياً. لتفعيله الآن: {{activate_url}}",
  },
  "doom.deleted": {
    label: "بعد المسح النهائي",
    vars: ["store"],
    body: "انتهت المهلة وتم حذف متجر {{store}} وبياناته. للبدء من جديد في أي وقت: الاستمارة أو رسالة لنا، وفريقنا يجهّزه من الأول.",
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
      "delivery.welcome": `متجرك جاهز — ${vars.store ?? ""}`,
      "payment.confirmed": `تم تفعيل متجرك — ${vars.store ?? ""}`,
      "hosting.renewed": `تم تجديد الاستضافة — ${vars.store ?? ""}`,
      "hosting.renewal_revoked": `بخصوص تجديد متجركم — ${vars.store ?? ""}`,
      "payment.golden": `تم تفعيل متجرك في الدائرة الذهبية — ${vars.store ?? ""}`,
      "payment.rejected": `تعذّر تأكيد الدفع — ${vars.store ?? ""}`,
      "form.received": `استلمنا استمارتك — ${vars.name ?? ""}`,
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