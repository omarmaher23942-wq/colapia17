import "server-only";
// meta-trace.ts — أثر قصير (آخر 40 حدثاً) لرحلة رسالة الوكيل: وصول الـ webhook ← بدء المعالجة ← فشل الذكاء الاصطناعي ←
// نجاح الإرسال أو فشله بسببه الحقيقي. سجلات Workers لا تُظهر هذه الخطوات دائماً، فنحفظها في Redis ونعرضها في
// /admin/launch. لا محتوى رسائل ولا رموز: أسماء الخطوات وأرقام وأسباب أخطاء قصيرة فقط.
import { redis } from "@/lib/redis";

const KEY = "meta:trace";

export async function trace(step: string, detail = ""): Promise<void> {
  try {
    await redis.lpush(KEY, `${new Date().toISOString()}|${step}|${detail.replace(/\s+/g, " ").slice(0, 280)}`);
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
