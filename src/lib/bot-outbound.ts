import "server-only";
// bot-outbound.ts — سجل الرسائل التي أرسلها وكيلنا نفسه. Meta ترجع لنا «صدى» (is_echo) لكل رسالة تخرج من الصفحة،
// ولا يكفي معرّف التطبيق للتمييز بين ردّ الوكيل وردّ موظف كتبه من صندوق الصفحة (إنستجرام يستخدم معرّف تطبيق آخر): كنا
// نحفظ ردود الوكيل كأنها من موظف فتتكرر في سجل المحادثة، ويظن الوكيل أن إنساناً تدخل فيكرر التعريف بنفسه.
// الحل: كل رسالة يرسلها الوكيل يُسجَّل معرّفها هنا، والصدى الذي معرّفه مسجّل يُتجاهل.
import { redis } from "@/lib/redis";

const key = (mid: string) => `bot:out:${mid}`;
const TTL_S = 7200;

export async function markOutbound(mid: string | null | undefined): Promise<void> {
  if (!mid) return;
  await redis.set(key(mid), 1, { ex: TTL_S }).catch(() => {});
}

/**
 * هل أرسل الوكيل هذه الرسالة؟ الصدى قد يصل قبل أن نسجّل المعرّف (الإرسال لم يُرجع بعد)، فننتظر قليلاً ونعيد الفحص.
 * عطل Redis = «لا» (فتُحفظ الرسالة كما كانت قبل هذا الإصلاح، ولا تضيع رسالة موظف حقيقية).
 */
export async function wasSentByBot(mid: string | null | undefined, waitMs = 3500): Promise<boolean> {
  if (!mid) return false;
  const deadline = Date.now() + waitMs;
  for (;;) {
    if (await redis.get(key(mid)).catch(() => null)) return true;
    if (Date.now() >= deadline) return false;
    await new Promise((r) => setTimeout(r, 450));
  }
}
