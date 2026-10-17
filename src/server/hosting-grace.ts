import "server-only";
// hosting-grace.ts — مهلة السماح بعد انتهاء الاشتراك المدفوع (أيام)، من إعداد «lifecycle» ← graceDays (افتراضي 3).
// ملف مستقل عن lifecycle/ ليستخدمه المتجر واللوحة والدفع دون استيراد مدد دورة الحياة كلها.
import { getFlag } from "@/lib/flags";
import { graceDaysFrom, HOSTING_GRACE_DAYS } from "@/lib/hosting";

export async function hostingGraceDays(): Promise<number> {
  const f = await getFlag<Record<string, unknown>>("lifecycle").catch(() => null);
  return graceDaysFrom(f?.config?.graceDays ?? HOSTING_GRACE_DAYS);
}
