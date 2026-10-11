"use server";
// agency-pricing.ts — المالك يضبط سلّم الأسعار والتجديد ومدد ما بعد التسليم من /admin/pricing. التغيير يسري على
// المتاجر التي تُسلَّم بعده فقط (سعر كل متجر مثبَّت عند تسليمه، والمهام المجدولة تُقرأ مددها عند الإيقاف).
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { setFlag } from "@/lib/flags";
import { platformUser } from "@/server/platform-guard";
import { ladderFrom } from "@/lib/platform-pricing";
import { timingsFrom } from "@/lifecycle/timings-rules";
import { PRICING_FLAG } from "@/server/pricing";
import { LIFECYCLE_FLAG } from "@/lifecycle/timings";
import { logActivity } from "@/agency/activity";

type Result = { ok: true } | { ok: false; error: string };

const tier = z.object({ upTo: z.number().int().min(1).max(100_000).nullable(), price: z.number().int().min(100).max(1_000_000) });
const pricingSchema = z.object({
  tiers: z.array(tier).min(1).max(10),
  basePrice: z.number().int().min(100).max(1_000_000),
  renewal: z.number().int().min(100).max(1_000_000),
});

export async function savePricingAction(raw: z.input<typeof pricingSchema>): Promise<Result> {
  const u = await platformUser({ cap: "pricing" });
  if (!u) return { ok: false, error: "الأسعار للمالك فقط." };
  const p = pricingSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "أرقام غير صالحة." };
  const t = p.data.tiers;
  for (let i = 0; i < t.length - 1; i++) {
    if (t[i]!.upTo === null) return { ok: false, error: "المرحلة بلا حد يجب أن تكون الأخيرة." };
    if (i > 0 && t[i]!.upTo! <= t[i - 1]!.upTo!) return { ok: false, error: "حدود المراحل يجب أن تتصاعد." };
  }
  const ladder = ladderFrom(p.data);
  await setFlag(PRICING_FLAG, true, ladder as unknown as Record<string, unknown>, "سلّم الأسعار والتجديد");
  await logActivity(u.id, "pricing.saved", null, ladder as unknown as Record<string, unknown>);
  revalidatePath("/admin/pricing");
  revalidatePath("/");
  return { ok: true };
}

const timingsSchema = z.object({
  trialHours: z.number().int().min(1).max(720),
  noticeHours: z.number().int().min(1).max(720),
  deleteHours: z.number().int().min(1).max(720),
});

export async function saveLifecycleAction(raw: z.input<typeof timingsSchema>): Promise<Result> {
  const u = await platformUser({ cap: "pricing" });
  if (!u) return { ok: false, error: "للمالك فقط." };
  const p = timingsSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "مدد غير صالحة (ساعة إلى 30 يوماً)." };
  const t = timingsFrom(p.data);
  await setFlag(LIFECYCLE_FLAG, true, t, "مدد ما بعد التسليم");
  await logActivity(u.id, "lifecycle.saved", null, t);
  revalidatePath("/admin/pricing");
  return { ok: true };
}
