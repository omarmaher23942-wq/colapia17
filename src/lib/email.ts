// lib/email.ts — محرك الإيميلات (v3).
//
// القاعدة الحاسمة:
// كل الإيميلات تُرسَل من النطاق الجذر (colapia.com) — NEVER from a
// subdomain. Resend يرفض أي sender من subdomain غير موثّق. هذا يعني أن
// hello@, orders@, noreply@ — كلها من colapia.com. متوافق مع SPF/DKIM.
import "server-only";
import type { ReactElement } from "react";
import { env, clientEnv, cleanSecretValue } from "@/lib/env";
import { resolveSender, type SenderKind } from "@/lib/email-sender";
import { cleanReplyTo, cleanSubject } from "@/lib/email-safe";
import { db } from "@/db/client";
import { systemEvents } from "@/db/schema";
import { log } from "@/lib/logger";

export type EmailButton = { title: string; url: string };

export type { SenderKind };

export type SendTemplatedOptions = {
  to: string | string[];
  subject: string;
  element: ReactElement;
  preheader?: string;
  replyTo?: string;
  idempotencyKey?: string;
  tags?: Array<{ name: string; value: string }>;
  senderKind?: SenderKind;
  /** اسم المرسل الظاهر للعميل (اسم المتجر في رسائل الطلبات)، وإلا Colapia. */
  fromName?: string;
  storeSubdomain?: string;
  merchantId?: string;
  storeId?: string;
  entityId?: string;
  tracking?: boolean;
  reqId?: string;
};

export type SendEmailOptions = {
  to: string | string[];
  subject: string;
  headline?: string;
  paragraphs: string[];
  buttons?: EmailButton[];
  storeName?: string;
  replyTo?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = [0, 800, 2_400];

function validRecipients(to: string | string[]): string[] {
  const list = Array.isArray(to) ? to : [to];
  return list
    .map((e) => e.trim().toLowerCase())
    .filter((e) => EMAIL_RE.test(e));
}

/**
 * عنوان المرسل: دائماً من النطاق الموثّق (lib/email-sender.ts فيه شرح السبب الجذري). النطاق من ROOT_DOMAIN وقت التشغيل
 * (لا من NEXT_PUBLIC_* المثبَّت وقت البناء)، وEMAIL_FROM يحدد الاسم والبادئة فقط متى كان على النطاق نفسه.
 */
export function resolveFrom(senderKind: SenderKind, _storeSubdomain?: string, fromName?: string): string {
  return resolveSender({ kind: senderKind, rootDomain: env.ROOT_DOMAIN || clientEnv.NEXT_PUBLIC_ROOT_DOMAIN, emailFrom: env.EMAIL_FROM, fromName });
}

/** مفتاح Resend كما يُلصق عادةً (مسافة أو سطر زائد، تنصيص، «RESEND_API_KEY=»، «Bearer»): سطر جديد في الترويسة كان يُفشل كل طلب. */
export const resendKey = (): string | undefined => cleanSecretValue(env.RESEND_API_KEY);

export async function renderEmail(element: ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const html = renderToStaticMarkup(element);
  return `<!DOCTYPE html>${html}`;
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

const TRANSPARENT_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function buildOpenPixel(logId: string): string {
  const url = `${clientEnv.NEXT_PUBLIC_APP_URL}/api/email/track/open?eid=${encodeURIComponent(logId)}`;
  return `<img src="${url}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" />`;
}

function wrapLinksForTracking(html: string, logId: string): string {
  const appUrl = clientEnv.NEXT_PUBLIC_APP_URL;
  const host = (() => {
    try {
      return new URL(appUrl).hostname;
    } catch {
      return null;
    }
  })();

  if (!host) return html;

  const linkRe = /(<a\s+[^>]*href=["'])([^"']+)(["'][^>]*>)/gi;

  return html.replace(linkRe, (full, before, url, after) => {
    if (/^(mailto:|tel:|#|javascript:)/i.test(url)) return full;
    if (url.includes("/api/email/track/")) return full;
    if (url.includes("unsubscribe")) return full;

    try {
      const parsed = new URL(url, appUrl);
      if (parsed.hostname !== host) return full;
      const wrapped = `${appUrl}/api/email/track/click?eid=${encodeURIComponent(logId)}&u=${encodeURIComponent(url)}`;
      return `${before}${wrapped}${after}`;
    } catch {
      return full;
    }
  });
}

async function sendViaResend(args: {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  idempotencyKey?: string;
  tags?: Array<{ name: string; value: string }>;
}): Promise<{ ok: boolean; id?: string; error?: string; status?: number; raw?: string }> {
  const apiKey = resendKey();
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY missing" };
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (args.idempotencyKey) {
    headers["Idempotency-Key"] = args.idempotencyKey.slice(0, 250);
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: args.from,
        to: args.to,
        subject: cleanSubject(args.subject),
        html: args.html,
        text: args.text,
        reply_to: cleanReplyTo(args.replyTo),
        tags: args.tags,
      }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });

    const raw = (await res.text().catch(() => "")).slice(0, 1000);
    if (!res.ok) {
      // رسالة Resend الحقيقية (مثل «The colapia.com domain is not verified» أو «API key is invalid»).
      let message = raw;
      try {
        message = (JSON.parse(raw) as { message?: string }).message ?? raw;
      } catch {
        /* نص عادي */
      }
      return { ok: false, status: res.status, error: (message || `HTTP ${res.status}`).slice(0, 500), raw };
    }
    let id: string | undefined;
    try {
      id = (JSON.parse(raw) as { id?: string }).id;
    } catch {
      /* رد غير متوقع */
    }
    return { ok: true, id, status: res.status, raw };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network" };
  }
}

export type SendResult = { ok: boolean; logId?: string; resendId?: string; error?: string; status?: number; raw?: string; from?: string; to?: string[] };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** سجل البريد في system_events (scope «email»، بعمود المتجر) ليظهر للمالك في صفحة المتجر وفي مركز الجاهزية. */
async function logEmail(level: "info" | "error", message: string, storeId: string | undefined, data: Record<string, unknown>) {
  try {
    await db.insert(systemEvents).values({ scope: "email", level, message: message.slice(0, 300), storeId: storeId && UUID_RE.test(storeId) ? storeId : null, data });
  } catch {
    // لا نكسر الإرسال بسبب فشل التسجيل.
  }
}

export async function sendTemplatedEmail(opts: SendTemplatedOptions): Promise<SendResult> {
  const recipients = validRecipients(opts.to);
  if (recipients.length === 0) {
    await logEmail("error", `email_failed: ${opts.subject}`, opts.storeId, { error: "no_valid_recipients", to: opts.to });
    return { ok: false, error: "no_valid_recipients" };
  }
  // بلا مفتاح Resend (بيئة محلية مثلاً) لا بريد؛ ويُسجَّل السبب صراحةً بدل الصمت.
  if (!resendKey()) {
    await logEmail("error", `email_failed: ${opts.subject}`, opts.storeId, { error: "RESEND_API_KEY missing", to: recipients });
    return { ok: false, error: "email_disabled" };
  }

  const senderKind = opts.senderKind ?? "hello";
  const from = resolveFrom(senderKind, opts.storeSubdomain, opts.fromName);
  // مع مفتاح منع التكرار يجب أن يتطابق جسم الرسالة في كل إعادة (وإلا يرفضها Resend بـ 409)، فلا رابط تتبع عشوائي.
  const shouldTrack = opts.tracking !== false && !opts.idempotencyKey;

  const logId = crypto.randomUUID();

  let html: string;
  try {
    html = await renderEmail(opts.element);
  } catch (err) {
    log.error(
      "ops",
      "email_render_failed",
      { reqId: opts.reqId, storeId: opts.storeId },
      "فشل تحويل React element إلى HTML",
      err
    );
    return { ok: false, error: "render_failed" };
  }

  if (shouldTrack) {
    html = wrapLinksForTracking(html, logId);
    html = html.replace(/<\/body>/i, `${buildOpenPixel(logId)}</body>`);
  }

  const text = htmlToText(html);

  let lastError: string | undefined;
  let lastStatus: number | undefined;
  let lastRaw: string | undefined;
  let resendId: string | undefined;
  let attempts = 0;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await new Promise((r) =>
        setTimeout(r, RETRY_BACKOFF_MS[attempt] ?? 2_400)
      );
    }

    attempts = attempt + 1;
    const result = await sendViaResend({
      from,
      to: recipients,
      subject: opts.subject,
      html,
      text,
      replyTo: opts.replyTo,
      // المفتاح نفسه في كل المحاولات: مهلة الشبكة بعد وصول الطلب لـ Resend لا تُرسل الرسالة مرتين.
      idempotencyKey: opts.idempotencyKey,
      tags: opts.tags,
    });

    lastStatus = result.status;
    lastRaw = result.raw;
    if (result.ok) {
      resendId = result.id ?? "accepted";
      break;
    }

    lastError = result.error;

    // أخطاء العميل نهائية (مفتاح، نطاق، عنوان)، عدا 429 (حد المعدل) فتُعاد.
    if (result.status && result.status >= 400 && result.status < 500 && result.status !== 429) {
      break;
    }
  }

  await logEmail(resendId ? "info" : "error", `${resendId ? "email_sent" : "email_failed"}: ${opts.subject}`, opts.storeId, {
    logId,
    resendId,
    from,
    to: recipients,
    subject: opts.subject.slice(0, 150),
    senderKind,
    storeSubdomain: opts.storeSubdomain,
    entityId: opts.entityId,
    attempts,
    status: lastStatus,
    error: lastError,
    raw: resendId ? undefined : lastRaw,
    reqId: opts.reqId,
  });

  if (!resendId) {
    log.warn(
      "ops",
      "email_send_failed",
      {
        reqId: opts.reqId,
        storeId: opts.storeId,
      },
      `فشل إرسال إيميل "${opts.subject}": ${lastError ?? "unknown"}`,
      lastError
    );
    return { ok: false, logId, error: lastError ?? "send_failed", status: lastStatus, raw: lastRaw, from, to: recipients };
  }

  return { ok: true, logId, resendId, status: lastStatus, raw: lastRaw, from, to: recipients };
}

export async function sendEmail(opts: SendEmailOptions): Promise<boolean> {
  const { GenericEmail } = await import("./email-templates/GenericEmail");
  const result = await sendTemplatedEmail({
    to: opts.to,
    subject: opts.subject,
    replyTo: opts.replyTo,
    element: GenericEmail({
      storeName: opts.storeName ?? "Colapia",
      headline: opts.headline,
      paragraphs: opts.paragraphs,
      buttons: opts.buttons,
    }),
    senderKind: "custom",
    tracking: false,
  });
  return result.ok;
}

export async function sendMerchantOnboardingReceivedEmail(
  merchantEmail: string,
  storeName: string,
  storeSubdomain?: string
) {
  const { GenericEmail } = await import("./email-templates/GenericEmail");
  return sendTemplatedEmail({
    to: merchantEmail,
    subject: `استلمنا استمارتك — جاري بناء متجر ${storeName}`,
    element: GenericEmail({
      storeName,
      headline: "استلمنا استمارتك",
      paragraphs: [
        `بدأنا العمل على بناء متجر ${storeName}. سنرسل إليك رسالة أخرى فور جاهزيته.`,
      ],
    }),
    senderKind: "hello",
    storeSubdomain,
    tracking: true,
  });
}

export async function sendMerchantStoreReadyEmail(args: {
  merchantEmail: string;
  storeName: string;
  storeUrl: string;
  adminUrl: string;
  storeSubdomain: string;
  storeId: string;
  merchantId: string;
  logoUrl?: string;
}) {
  const { StoreReadyEmail } = await import("./email-templates/StoreReadyEmail");
  return sendTemplatedEmail({
    to: args.merchantEmail,
    subject: `مبروك — متجر ${args.storeName} جاهز الآن`,
    element: StoreReadyEmail({
      storeName: args.storeName,
      storeUrl: args.storeUrl,
      adminUrl: args.adminUrl,
      logoUrl: args.logoUrl,
    } as never),
    senderKind: "hello",
    storeSubdomain: args.storeSubdomain,
    storeId: args.storeId,
    merchantId: args.merchantId,
    tracking: true,
  });
}

export async function sendMerchantNewOrderEmail(args: {
  merchantEmail: string;
  storeName: string;
  storeSubdomain: string;
  storeId: string;
  merchantId: string;
  orderCode: string;
  customerName: string;
  totalAmount: string;
  governorate: string;
  adminOrderUrl: string;
  logoUrl?: string;
}) {
  const { NewOrderMerchantEmail } = await import(
    "./email-templates/NewOrderMerchantEmail"
  );
  return sendTemplatedEmail({
    to: args.merchantEmail,
    subject: `طلب جديد في ${args.storeName} (${args.orderCode})`,
    element: NewOrderMerchantEmail(args),
    senderKind: "orders",
    storeSubdomain: args.storeSubdomain,
    storeId: args.storeId,
    merchantId: args.merchantId,
    entityId: args.orderCode,
    tags: [{ name: "category", value: "order" }],
    tracking: true,
  });
}

export async function sendBulkTemplated(
  items: SendTemplatedOptions[],
  options: { concurrency?: number; delayMs?: number } = {}
): Promise<{ sent: number; failed: number }> {
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 2, 5));
  const delayMs = options.delayMs ?? 600;

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map((item) => sendTemplatedEmail(item))
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.ok) sent++;
      else failed++;
    }
    if (i + concurrency < items.length) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return { sent, failed };
}

export const _TEST_PIXEL = TRANSPARENT_PIXEL;