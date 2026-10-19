"use server";
// agency-pricing.ts — المالك يضبط الأسعار (التجهيز والباقات الشهرية وحدودها والدائرة الذهبية) ومدد دورة الحياة من
// /admin/pricing (للمالك فقط، بسجل نشاط). التغيير يسري على الدفعات الجديدة؛ الدفعة المسجّلة تحتفظ بباقتها ومدتها ومبلغها.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { setFlag } from "@/lib/flags";
import { platformUser } from "@/server/platform-guard";
import { validatePricing } from "@/lib/platform-pricing";
import { timingsFrom } from "@/lifecycle/timings-rules";
import { PRICING_FLAG } from "@/server/pricing";
import { LIFECYCLE_FLAG } from "@/lifecycle/timings";
import { logActivity } from "@/agency/activity";

type Result = { ok: true } | { ok: false; error: string };

/**
 * نموذج الأسعار كاملاً من /admin/pricing (رسوم التجهيز، الدائرة الذهبية، الباقات الثلاث وحدودها، المدد، المميَّزة).
 * التحقق صارم في lib/platform-pricing.ts (validatePricing): لا قيمة افتراضية صامتة، والخطأ يُرد بمكانه.
 */
export async function savePricingAction(raw: unknown): Promise<Result> {
  const u = await platformUser({ cap: "pricing" });
  if (!u) return { ok: false, error: "الأسعار للمالك فقط." };
  const v = validatePricing(raw);
  if (!v.ok) return { ok: false, error: v.error };
  await setFlag(PRICING_FLAG, true, v.model as unknown as Record<string, unknown>, "الأسعار والباقات وحدودها");
  await logActivity(u.id, "pricing.saved", null, v.model as unknown as Record<string, unknown>);
  revalidatePath("/admin/pricing");
  revalidatePath("/");
  revalidatePath("/terms");
  return { ok: true };
}

const timingsSchema = z.object({
  trialHours: z.number().int().min(1).max(720),
  noticeHours: z.number().int().min(1).max(720),
  deleteHours: z.number().int().min(1).max(720),
  graceDays: z.number().int().min(0).max(30),
});

export async function saveLifecycleAction(raw: z.input<typeof timingsSchema>): Promise<Result> {
  const u = await platformUser({ cap: "pricing" });
  if (!u) return { ok: false, error: "للمالك فقط." };
  const p = timingsSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "مدد غير صالحة (من ساعة إلى 30 يوماً، والسماح من 0 إلى 30 يوماً)." };
  const t = timingsFrom(p.data);
  await setFlag(LIFECYCLE_FLAG, true, t, "مدد دورة الحياة");
  await logActivity(u.id, "lifecycle.saved", null, t);
  revalidatePath("/admin/pricing");
  return { ok: true };
}
