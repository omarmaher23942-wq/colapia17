"use server";
// agency-pricing.ts — المالك يضبط الأسعار (سعر المشروع، الدائرة الذهبية، شروط التعديل، نص المشاريع الأخرى) من /admin/pricing
// (للمالك فقط، بسجل نشاط). التغيير يسري على الحجوزات الجديدة؛ الدفعة المسجّلة تحتفظ بمبلغها.
import { revalidatePath } from "next/cache";
import { setFlag } from "@/lib/flags";
import { platformUser } from "@/server/platform-guard";
import { validatePricing } from "@/lib/platform-pricing";
import { PRICING_FLAG } from "@/server/pricing";
import { logActivity } from "@/agency/activity";

type Result = { ok: true } | { ok: false; error: string };

/** نموذج الأسعار كاملاً. التحقق صارم في lib/platform-pricing.ts (validatePricing): لا قيمة افتراضية صامتة، والخطأ يُرد بسببه. */
export async function savePricingAction(raw: unknown): Promise<Result> {
  const u = await platformUser({ cap: "pricing" });
  if (!u) return { ok: false, error: "الأسعار للمالك فقط." };
  const v = validatePricing(raw);
  if (!v.ok) return { ok: false, error: v.error };
  await setFlag(PRICING_FLAG, true, v.model as unknown as Record<string, unknown>, "الأسعار وشروط التعديل");
  await logActivity(u.id, "pricing.saved", null, v.model as unknown as Record<string, unknown>);
  revalidatePath("/admin/pricing");
  revalidatePath("/golden");
  revalidatePath("/");
  revalidatePath("/terms");
  return { ok: true };
}
