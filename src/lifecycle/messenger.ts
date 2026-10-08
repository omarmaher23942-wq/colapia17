import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { onboardingSessions, intakes } from "@/db/schema";
import { env } from "@/lib/env";
import { stripEmoji } from "@/lib/emoji";
import { notifyMerchant, notifyAdmin } from "@/ai/lifecycle/notify";
import { recordEvent } from "./machine";

type LinkButton = { title: string; url: string };

export type OutboundMessage = {
  key: string;
  text: string;
  buttons?: LinkButton[];
  purpose: "transactional" | "promotional";
  email?: { subject: string; always?: boolean };
  card?: Parameters<typeof notifyMerchant>[2] extends infer O ? (O extends { card?: infer C } ? C : never) : never;
};

export type DeliveryReport = { viaMeta: boolean; emailed: boolean; undelivered: boolean };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function merchantEmail(storeId: string): Promise<string | null> {
  const [row] = await db
    .select({
      emailFromStore: sql<string | null>`${onboardingSessions.submission} -> 'store' ->> 'email'`,
      emailFromContact: sql<string | null>`${onboardingSessions.submission} -> 'contact' ->> 'email'`,
    })
    .from(onboardingSessions)
    .where(and(eq(onboardingSessions.storeId, storeId), eq(onboardingSessions.status, "submitted")))
    .orderBy(desc(onboardingSessions.submittedAt))
    .limit(1);

  const e = (row?.emailFromStore ?? row?.emailFromContact)?.trim().toLowerCase();
  if (e && EMAIL_RE.test(e)) return e;

  const [intake] = await db
    .select({ email: sql<string | null>`${intakes.brief} ->> 'email'` })
    .from(intakes)
    .where(eq(intakes.storeId, storeId))
    .limit(1);

  const ie = intake?.email?.trim().toLowerCase();
  return ie && EMAIL_RE.test(ie) ? ie : null;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function emailHtml(text: string, buttons: LinkButton[]) {
  const paras = text
    .split(/\n+/)
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.9;color:#0b0e24">${esc(p)}</p>`)
    .join("");
  const btns = buttons
    .map((b) => `<a href="${esc(b.url)}" style="display:inline-block;margin:6px 0 6px 8px;padding:12px 22px;border-radius:10px;background:#0b0e24;color:#eaf0ff;text-decoration:none;font-weight:700">${esc(b.title)}</a>`)
    .join("");
  return `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">${paras}<div style="margin-top:8px">${btns}</div><p style="margin:28px 0 0;font-size:12px;color:#6f7aa8">فريق Colapia</p></div>`;
}

async function sendEmail(a: { to: string; subject: string; text: string; buttons: LinkButton[]; key: string }): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false;
  const links = a.buttons.map((b) => `${b.title}: ${b.url}`).join("\n");
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": a.key.slice(0, 250),
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [a.to],
        subject: stripEmoji(a.subject).slice(0, 150),
        html: emailHtml(a.text, a.buttons),
        text: links ? `${a.text}\n\n${links}` : a.text,
      }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[messenger] resend failed", res.status, (await res.text().catch(() => "")).slice(0, 300));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[messenger] resend error", e);
    return false;
  }
}

export async function deliverToMerchant(storeId: string, m: OutboundMessage): Promise<DeliveryReport> {
  const text = stripEmoji(m.text).trim();
  const buttons = (m.buttons ?? []).filter((b) => /^https?:\/\//.test(b.url)).map((b) => ({ ...b, title: stripEmoji(b.title) }));

  const viaMeta = await notifyMerchant(storeId, text, {
    buttons,
    card: m.card,
    promotional: m.purpose === "promotional",
  }).catch((e) => {
    console.error("[messenger] meta failed", e);
    return false;
  });

  let emailed = false;
  if (m.email && (!viaMeta || m.email.always)) {
    const to = await merchantEmail(storeId);
    if (to) emailed = await sendEmail({ to, subject: m.email.subject, text, buttons, key: m.key });
  }

  const undelivered = !viaMeta && !emailed;
  await recordEvent({
    storeId,
    type: undelivered ? "message.undelivered" : "message.outbound",
    actor: "system",
    data: { key: m.key, purpose: m.purpose, viaMeta, emailed, queuedForNextMessage: !viaMeta },
  });
  if (undelivered) await notifyAdmin(`تعذّر توصيل رسالة (${m.key}) للتاجر. ستُسلَّم عند أول رسالة منه`, { storeId, key: m.key });

  return { viaMeta, emailed, undelivered };
}