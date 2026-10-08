"use server";
// إعادة تصميم المتجر بالذكاء الاصطناعي من لوحة التاجر.
import { getMerchantStoreOrNull } from "@/server/auth";
import { allow } from "@/lib/ratelimit";
import { getRedesignState, startRedesign, type RedesignState } from "@/server/redesign";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export async function startRedesignAction(): Promise<Result> {
  const s = await getMerchantStoreOrNull();
  if (!s) return { ok: false, error: "غير مصرح" };
  if (s.store.ownedUrl) return { ok: false, error: "متجرك انتقل لموقعك الخاص؛ أعد التصميم من لوحته هناك." };
  const state = await getRedesignState(s.storeId);
  if (state?.status === "running") return { ok: false, error: "إعادة التصميم تعمل الآن، انتظر حتى تنتهي." };
  if (!(await allow("redesign", s.storeId))) return { ok: false, error: "وصلت للحد اليومي لإعادة التصميم (6 مرات). جرّب غداً." };
  try {
    await startRedesign(s.storeId);
    return { ok: true };
  } catch {
    return { ok: false, error: "تعذر بدء إعادة التصميم الآن، أعد المحاولة بعد دقيقة." };
  }
}

export async function redesignStatusAction(): Promise<RedesignState | null> {
  const s = await getMerchantStoreOrNull();
  if (!s) return null;
  return getRedesignState(s.storeId);
}
