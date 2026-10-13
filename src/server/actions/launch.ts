"use server";
// launch.ts — أزرار مركز جاهزية الإطلاق: اختبار نماذج قراءة الصور فرادى، وفك إيقافها المؤقت، وبريد تجربة للمالك.
import { requirePlatformCap } from "@/server/platform-guard";
import { probeTier, resetBreakers, type ProbeResult } from "@/ai/providers";
import { sendEmail } from "@/lib/email";
import { clientEnv } from "@/lib/env";

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

export async function resetVisionAction(): Promise<{ ok: true }> {
  await requirePlatformCap("settings");
  await resetBreakers("visionFast");
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
