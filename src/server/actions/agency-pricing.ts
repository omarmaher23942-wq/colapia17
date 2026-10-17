"use server";
// agency-pricing.ts — المالك يضبط الباقات والتجديد والدائرة الذهبية ومدد دورة الحياة من /admin/pricing
// (للمالك فقط، بحفظ منفصل لكل بطاقة وسجل نشاط). التغيير يسري على الدفعات الجديدة؛ الدفعة المسجّلة تحتفظ بخطتها ومدتها.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { setFlag } from "@/lib/flags";
import { platformUser } from "@/server/platform-guard";
import { validateGolden, validatePlans } from "@/lib/platform-pricing";
import { timingsFrom } from "@/lifecycle/timings-rules";
import { PRICING_FLAG, currentPricing } from "@/server/pricing";
import { LIFECYCLE_FLAG } from "@/lifecycle/timings";
import { logActivity } from "@/agency/activity";

type Result = { ok: true } | { ok: false; error: string };

const plansSchema = z.object({
  plans: z.array(z.object({ months: z.number(), price: z.number(), renewal: z.number() })).length(3),
  featured: z.number(),
});

/** أسعار الباقات الثلاث والباقة المميَّزة (لا يمس الدائرة الذهبية). */
export async function savePlansAction(raw: z.input<typeof plansSchema>): Promise<Result> {
  const u = await platformUser({ cap: "pricing" });
  if (!u) return { ok: false, error: "الأسعار للمالك فقط." };
  const p = plansSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "أرقام غير صالحة." };
  const v = validatePlans(p.data);
  if (!v.ok) return { ok: false, error: v.error };
  const next = { ...(await currentPricing()), plans: v.plans, featured: v.featured };
  await setFlag(PRICING_FLAG, true, next as unknown as Record<string, unknown>, "أسعار الباقات والتجديد");
  await logActivity(u.id, "pricing.plans_saved", null, { plans: v.plans, featured: v.featured });
  revalidatePath("/admin/pricing");
  revalidatePath("/");
  return { ok: true };
}

const goldenSchema = z.object({
  enabled: z.boolean(),
  code: z.string(),
  price: z.number(),
  months: z.number(),
  seats: z.number(),
});

/** عرض «الدائرة الذهبية»: تشغيل/إيقاف، الكود، السعر، المدة، والمقاعد (لا يمس الباقات). */
export async function saveGoldenAction(raw: z.input<typeof goldenSchema>): Promise<Result> {
  const u = await platformUser({ cap: "pricing" });
  if (!u) return { ok: false, error: "الأسعار للمالك فقط." };
  const p = goldenSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "أرقام غير صالحة." };
  const v = validateGolden(p.data);
  if (!v.ok) return { ok: false, error: v.error };
  const next = { ...(await currentPricing()), golden: v.golden };
  await setFlag(PRICING_FLAG, true, next as unknown as Record<string, unknown>, "عرض الدائرة الذهبية");
  await logActivity(u.id, "pricing.golden_saved", null, v.golden as unknown as Record<string, unknown>);
  revalidatePath("/admin/pricing");
  revalidatePath("/");
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
