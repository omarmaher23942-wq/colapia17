"use server";
// launch.ts — أزرار مركز جاهزية الإطلاق: اختبار نماذج قراءة الصور والمحادثة فرادى، وفك إيقافها المؤقت، وبريد تجربة للمالك.
import { requirePlatformCap } from "@/server/platform-guard";
import { probeAgent } from "@/ai/agents/closer/runtime";
import { probeTier, resetBreakers, type ProbeResult } from "@/ai/providers";
import { sendTemplatedEmail } from "@/lib/email";
import { clientEnv } from "@/lib/env";
import { mediaApi } from "@/server/media-host";
import { redis } from "@/lib/redis";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { conversations } from "@/db/schema";

/** صورة اختبار حقيقية: شعار Colapia من الأصول المنشورة (لا ملف من القرص: يعمل على Cloudflare أيضاً). */
async function testImage(): Promise<Uint8Array> {
  const r = await fetch(new URL("/logo.png", clientEnv.NEXT_PUBLIC_APP_URL), { signal: AbortSignal.timeout(8_000) });
  if (!r.ok) throw new Error(`تعذر تحميل صورة الاختبار (${r.status})`);
  return new Uint8Array(await r.arrayBuffer());
}

export async function testVisionAction(): Promise<{ ok: true; results: ProbeResult[] } | { ok: false; error: string }> {
  await requirePlatformCap("settings");
  try {
    const image = await testImage();
    const results = await probeTier("visionFast", [
      { role: "user", content: [{ type: "text", text: "Describe this image in five words." }, { type: "image", image, mediaType: "image/png" }] },
    ]);
    return { ok: true, results };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e).slice(0, 200) };
  }
}

/** نماذج المحادثة (وكيل الرسائل) فرادى: سؤال قصير لكل نموذج بنفس ترتيب الوكيل، وسبب فشل كل واحد كما هو. */
export async function testChatAction(): Promise<{ ok: true; results: ProbeResult[] } | { ok: false; error: string }> {
  await requirePlatformCap("settings");
  try {
    const results = await probeTier("chat", [{ role: "user", content: "رد بكلمة واحدة: تمام" }]);
    return { ok: true, results };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e).slice(0, 200) };
  }
}

/** رد كامل من الوكيل على رسالة تجريبية (نفس البرومبت والمخطط والسلسلة، بلا إرسال لأحد ولا حفظ). */
export async function testAgentAction(text: string): Promise<{ ok: true; reply: string; confirmCreate: boolean; leadFound: string; provider: string; ms: number } | { ok: false; error: string }> {
  await requirePlatformCap("settings");
  const t = typeof text === "string" ? text.trim() : "";
  return probeAgent(t || "هاي");
}

/** اختبار الرفع الحقيقي: يحفظ صورة (شعار المنصة) في مساحة الملفات ويعيد رابطها، فيعرضها المتصفح ليتأكد الفريق أن العرض يعمل أيضاً. */
export async function testMediaAction(): Promise<{ ok: true; url: string; key: string; host: string } | { ok: false; error: string }> {
  await requirePlatformCap("settings");
  try {
    const api = await mediaApi();
    if (!api) return { ok: false, error: "لا مساحة ملفات مضبوطة (R2 أو UploadThing): راجع فحص «مساحة الصور»" };
    const bytes = await testImage();
    const up = await api.upload({ bytes, name: "launch-check.png", type: "image/png", ext: "png", prefix: "tmp/launch-check" });
    if (!up) return { ok: false, error: "رفض الخادم حفظ الصورة: راجع فحص «مساحة الصور» وسجلات الخادم" };
    // نتذكر مفتاح ملف الاختبار وحده: التنظيف لا يحذف إلا ما أنشأه هذا الاختبار.
    await redis.set(`launch:media-test:${up.key}`, "1", { ex: 600 }).catch(() => null);
    return { ok: true, url: up.url, key: up.key, host: new URL(up.url).hostname };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e).slice(0, 200) };
  }
}

export async function cleanupMediaTestAction(key: string): Promise<{ ok: boolean }> {
  await requirePlatformCap("settings");
  if (typeof key !== "string" || key.length > 200 || !(await redis.get(`launch:media-test:${key}`).catch(() => null))) return { ok: false };
  const api = await mediaApi();
  const ok = Boolean(api && (await api.remove([key]).catch(() => false)));
  if (ok) await redis.del(`launch:media-test:${key}`).catch(() => null);
  return { ok };
}

export async function resetModelsAction(tier: "visionFast" | "chat"): Promise<{ ok: true }> {
  await requirePlatformCap("settings");
  await resetBreakers(tier === "chat" ? "chat" : "visionFast");
  return { ok: true };
}

const EMAIL_ERRORS: Record<string, string> = {
  email_disabled: "مفتاح Resend غير مضبوط في متغيرات الخادم (RESEND_API_KEY)، فلا يخرج أي بريد.",
  no_valid_recipients: "بريد حسابكم غير صالح للإرسال.",
  render_failed: "تعذر تجهيز قالب الرسالة.",
};

export type TestEmailResult = { ok: boolean; to?: string; from?: string; status?: number; raw?: string; id?: string; error?: string };

/** بريد تجربة لبريد المالك نفسه، ويعيد رد Resend الحقيقي كما هو (الحالة والنص) لتشخيص أي رفض. */
export async function sendTestEmailAction(): Promise<TestEmailResult> {
  const u = await requirePlatformCap("settings");
  if (!u.email) return { ok: false, error: "لا بريد لحسابك" };
  const { GenericEmail } = await import("@/lib/email-templates/GenericEmail");
  const r = await sendTemplatedEmail({
    to: u.email,
    subject: "بريد تجربة من Colapia",
    element: GenericEmail({ storeName: "Colapia", headline: "البريد يعمل", paragraphs: ["وصلتك هذه الرسالة من مركز جاهزية الإطلاق، فإرسال البريد من المنصة سليم."] }),
    senderKind: "hello",
    tracking: false,
  }).catch((e: unknown) => ({ ok: false as const, error: String((e as Error)?.message ?? e).slice(0, 300) }));
  return {
    ok: r.ok,
    to: u.email,
    from: "from" in r ? r.from : undefined,
    status: "status" in r ? r.status : undefined,
    raw: "raw" in r ? r.raw : undefined,
    id: "resendId" in r ? r.resendId : undefined,
    error: r.ok ? undefined : EMAIL_ERRORS[r.error ?? ""] ?? r.error,
  };
}

/** يعيد الوكيل للعمل في كل المحادثات الموقوفة على «تدخل بشري» (يدوياً أو بتحويل الوكيل). */
export async function resumeAllAgentAction(): Promise<{ ok: true; count: number }> {
  await requirePlatformCap("settings", "غير مصرح");
  const rows = await db
    .update(conversations)
    .set({ botPaused: false, botPausedUntil: null, stage: "persuasion", updatedAt: new Date() })
    // لا يشمل المحادثات التي أغلقها الوكيل بعد موافقة العميل (تسليمها بيد المالك): استئنافها بزرها هي.
    .where(and(eq(conversations.botPaused, true), sql`coalesce(${conversations.memory}->>'closedBy', '') <> 'agent_done'`))
    .returning({ id: conversations.id });
  return { ok: true, count: rows.length };
}

/**
 * إعادة زرع متجر العرض demo.colapia.com بآخر بيانات الكتالوج (31 منتجاً بصور موثقة). يحذف متجر العرض وحده ويعيد بناءه
 * (scripts/demo/seed-core.ts). للمالك فقط. زمن التنفيذ بضع ثوانٍ.
 */
export async function reseedDemoAction(): Promise<{ ok: true; summary: string } | { ok: false; error: string }> {
  await requirePlatformCap("settings");
  try {
    const { seedDemo } = await import("../../../scripts/demo/seed-core");
    const { DEMO_DEFAULT_EMAIL } = await import("../../../scripts/demo/catalog");
    const r = await seedDemo(process.env.DEMO_MERCHANT_EMAIL?.trim().toLowerCase() || DEMO_DEFAULT_EMAIL);
    return { ok: true, summary: `${r.products} منتجاً، ${r.variants} تركيبة، ${r.reviews} تقييماً، ${r.questions} سؤالاً` };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e).slice(0, 300) };
  }
}
