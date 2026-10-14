import "server-only";
// meta-trace.ts — أثر قصير (آخر 40 حدثاً) لرحلة رسالة الوكيل: وصول الـ webhook ← بدء المعالجة ← فشل الذكاء الاصطناعي ←
// نجاح الإرسال أو فشله بسببه الحقيقي. سجلات Workers لا تُظهر هذه الخطوات دائماً، فنحفظها في Redis ونعرضها في
// /admin/launch. لا محتوى رسائل ولا رموز: أسماء الخطوات وأرقام وأسباب أخطاء قصيرة فقط.
import { redis } from "@/lib/redis";

const KEY = "meta:trace";

/**
 * بصمة الخادم الذي يكتب الأثر: أين يعمل (cf/vercel/node) وأي commit، وشكل مفاتيح الذكاء الاصطناعي (أول 3 أحرف فقط: AIz = مفتاح
 * Gemini صالح الشكل، AQ. = مفتاح Vertex لا يقبله Gemini، gsk = مفتاح Groq) ونموذج Gemini المضبوط. تكشف إن كانت الرسالة تُعالج
 * على نشر آخر (مثل Vercel القديم) بمفاتيح أخرى.
 */
export function runtimeTag(): string {
  const where = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers" ? "cf" : process.env.VERCEL === "1" ? "vercel" : "node";
  const sha = (process.env.BUILD_COMMIT_SHA ?? "").slice(0, 7) || "?";
  const shape = (v?: string) => (v ? v.slice(0, 3) : "-");
  return `${where}@${sha} gem=${shape(process.env.GEMINI_API_KEY)}/${process.env.GEMINI_MODEL ?? "-"} groq=${shape(process.env.GROQ_API_KEY)}`;
}

export async function trace(step: string, detail = ""): Promise<void> {
  try {
    await redis.lpush(KEY, `${new Date().toISOString()}|${step}|${detail.replace(/\s+/g, " ").slice(0, 260)} [${runtimeTag()}]`);
    await redis.ltrim(KEY, 0, 39);
  } catch {
    // الأثر للتشخيص فقط: فشله لا يجوز أن يؤثر على الرد.
  }
}

export async function readTrace(n = 14): Promise<{ at: string; step: string; detail: string }[]> {
  try {
    const rows = (await redis.lrange<string>(KEY, 0, n - 1)) ?? [];
    return rows.map((r) => {
      const [at = "", step = "", ...rest] = String(r).split("|");
      return { at, step, detail: rest.join("|") };
    });
  } catch {
    return [];
  }
}
