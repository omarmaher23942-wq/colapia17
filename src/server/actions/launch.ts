"use server";
// launch.ts — أزرار مركز جاهزية الإطلاق: اختبار نماذج قراءة الصور والمحادثة فرادى، وفك إيقافها المؤقت، وبريد تجربة للمالك.
import { requirePlatformCap } from "@/server/platform-guard";
import { probeAgent } from "@/ai/agents/closer/runtime";
import { probeTier, resetBreakers, type ProbeResult } from "@/ai/providers";
import { sendEmail } from "@/lib/email";
import { clientEnv } from "@/lib/env";
import { mediaApi } from "@/server/media-host";
import { redis } from "@/lib/redis";
import { eq } from "drizzle-orm";
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

export async function sendTestEmailAction(): Promise<{ ok: boolean; to?: string; error?: string }> {
  const u = await requirePlatformCap("settings");
  if (!u.email) return { ok: false, error: "لا بريد لحسابك" };
  const ok = await sendEmail({
    to: u.email,
    subject: "بريد تجربة من Colapia",
    headline: "البريد يعمل",
    paragraphs: ["وصلتك هذه الرسالة من مركز جاهزية الإطلاق، فإرسال البريد من المنصة سليم."],
  }).catch(() => false);
  return ok ? { ok: true, to: u.email } : { ok: false, error: "تعذر الإرسال: راجع فحص البريد (Resend) في الصفحة" };
}

/** يعيد الوكيل للعمل في كل المحادثات الموقوفة على «تدخل بشري» (يدوياً أو بتحويل الوكيل). */
export async function resumeAllAgentAction(): Promise<{ ok: true; count: number }> {
  await requirePlatformCap("settings", "غير مصرح");
  const rows = await db
    .update(conversations)
    .set({ botPaused: false, botPausedUntil: null, stage: "persuasion", updatedAt: new Date() })
    .where(eq(conversations.botPaused, true))
    .returning({ id: conversations.id });
  return { ok: true, count: rows.length };
}
