// (نفس الملف مع تعديل الدالة الأخيرة)
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { messageTemplates } from "@/db/schema";
import { clientEnv, env } from "@/lib/env";
import { platformPricing } from "@/lib/platform-pricing";
import { stripEmoji } from "@/lib/emoji";
import { sendTemplatedEmail } from "@/lib/email";

type Def = { label: string; vars: readonly string[]; body: string };

export const TEMPLATE_DEFAULTS = {
  "link.issued": {
    label: "إرسال رابط الاستمارة",
    vars: [],
    body: "تمام، ده رابط استمارة متجرك السريعة. بتاخد حوالي دقيقتين بس، بتدخل فيها بيانات متجرك وصور منتجاتك، وفريقنا والذكاء الاصطناعي هيبدأوا التنفيذ فوراً لتجربته مجاناً.",
  },
  "link.reissued": {
    label: "تجديد رابط الاستمارة",
    vars: [],
    body: "ده رابطك الجديد، وكل اللي كتبته قبل كده محفوظ وتقدر تكمل عليه بكل سهولة.",
  },
  "form.received": {
    label: "استلام الاستمارة",
    vars: ["name"],
    body: "وصلتنا استمارتك يا {{name}} بنجاح! متجرك بيتبني دلوقتي بالذكاء الاصطناعي وهيوصلك الرابط هنا في ثواني معدودة.",
  },
  "delivery.welcome": {
    label: "رسالة تسليم المتجر",
    vars: ["store", "store_url", "magic_url"],
    body: "مبروك! متجرك {{store}} اتبنى وشغال دلوقتي في أبهى صورة.\nرابط المتجر للزبائن: {{store_url}}\nرابط لوحة التحكم الخاصة بك: {{magic_url}}\nتقدر تجربه وتدير طلباتك وتشوف كل حاجة بنفسك مجاناً.",
  },
  "delivery.guide": {
    label: "توجيه ما بعد التسليم",
    vars: [],
    body: "جرّب متجرك كأنك زبون: اضغط على زر 'جرّب كزبون' في لوحة التحكم، واطلب منتج وشوف إزاي الطلب بيوصلك وفاتورته بتطلع بضغطة زر واحدة.",
  },
  "payment.invite": {
    label: "دعوة التملك الدائم",
    vars: ["store", "price", "vodafone", "instapay", "activate_url"],
    body: "عجبك متجرك {{store}}؟ عشان تمتلكه للأبد وتفتح استقبال أوردرات زبائنك، ادفع {{price}} جنيه فقط لمرة واحدة مدى الحياة بدون أي اشتراكات وبدون أي عمولة.\nفودافون كاش: {{vodafone}}\nإنستاباي: {{instapay}}\nبعد التحويل ارفع صورة الإيصال من هنا: {{activate_url}}\nبنراجع الإيصال بنفسنا، وأول ما نقبله بيتفعّل متجرك ويوصلك بريد.",
  },
  "payment.confirmed": {
    label: "تأكيد الدفع والتفعيل الدائم",
    vars: ["store", "store_url"],
    body: "تم تأكيد دفعك! متجر {{store}} اتفعّل، بدون أي اشتراكات وبدون أي عمولة على مبيعاتك.\nالخطوة الجاية: من لوحة التحكم افتح «امتلك متجرك» واستلم متجرك وبياناته على حساباتك المجانية بخطوات مشروحة.\nرابط متجرك: {{store_url}}",
  },
  "payment.rejected": {
    label: "رفض الدفع",
    vars: ["store", "hours", "reason_line", "vodafone", "instapay", "activate_url"],
    body: "راجعنا إيصال التحويل ومقدرناش نأكده.{{reason_line}}\nمتجر {{store}} لسه محفوظ ليك لمدة {{hours}} ساعة. لو حولت المبلغ، ارفع الإيصال الصحيح من هنا: {{activate_url}}\nفودافون كاش: {{vodafone}}\nإنستاباي: {{instapay}}",
  },
  "doom.reminder_12h": {
    label: "تذكير قبل المسح بـ 12 ساعة",
    vars: ["store", "price", "activate_url"],
    body: "فاضل 12 ساعة على انتهاء مهلة حفظ متجر {{store}}. لتفعيله مدى الحياة بـ {{price}} ج ارفع إثبات الدفع من هنا: {{activate_url}}",
  },
  "doom.reminder_1h": {
    label: "تذكير قبل المسح بساعة",
    vars: ["store", "activate_url"],
    body: "فاضل ساعة واحدة على انتهاء مهلة متجر {{store}} وبعدها هيتم مسحه نهائياً. لتفعيله الآن: {{activate_url}}",
  },
  "doom.deleted": {
    label: "بعد المسح النهائي",
    vars: ["store"],
    body: "انتهت المهلة وتم مسح متجر {{store}}. لو حابب تبدأ متجر جديد في أي وقت، راسلنا هنا وهنجهز لك كل حاجة في دقائق.",
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

export function paymentVars(storeName: string, activateUrl: string = billingUrl()) {
  return {
    store: storeName,
    price: platformPricing().price,
    vodafone: env.VODAFONE_CASH_NUMBER,
    instapay: env.INSTAPAY_NUMBER,
    activate_url: activateUrl,
  };
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
      "payment.confirmed": `تم تأكيد التفعيل الدائم — ${vars.store ?? ""}`,
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