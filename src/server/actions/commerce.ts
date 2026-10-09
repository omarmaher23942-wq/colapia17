"use server";

// commerce.ts — إدارة الشحن من داشبورد التاجر (الخصومات في discounts.ts، والعملاء في customers.ts).
// كل إجراء: جلسة تاجر بمتجر يملكه + مدخلات محققة بـ Zod (المفاتيح غير المعروفة تُحذف) + شرط storeId في كل كتابة.
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getTenantDb } from "@/db/tenant";
import { shippingZones } from "@/db/schema";
import { getMerchantStoreOrNull } from "@/server/auth";
import { GOVERNORATES } from "@/lib/egypt";

type Result = { error?: string };

const GOV_CODES = new Set<string>(GOVERNORATES.map((g) => g.code));
const egpToPiasters = (v: number) => Math.round(v * 100);

// ─── الشحن ──────────────────────────────────────────────────────────────────

const shippingRowSchema = z
  .object({
    governorate: z.string().refine((g) => GOV_CODES.has(g), "محافظة غير معروفة"),
    fee: z.coerce.number().min(0).max(10_000),
    codExtra: z.coerce.number().min(0).max(10_000),
    etaMin: z.coerce.number().int().min(0).max(60),
    etaMax: z.coerce.number().int().min(0).max(60),
    isActive: z.boolean(),
  })
  .refine((r) => r.etaMax >= r.etaMin, { message: "أقصى مدة توصيل أقل من أدناها" });

const shippingTableSchema = z
  .array(shippingRowSchema)
  .max(GOV_CODES.size)
  .refine((rows) => new Set(rows.map((r) => r.governorate)).size === rows.length, "محافظة مكررة");

/** حفظ جدول الشحن كاملاً دفعة واحدة وذرياً: إما يُحفظ كله أو لا يتغير شيء. */
export async function saveShippingAction(input: unknown): Promise<Result> {
  const s = await getMerchantStoreOrNull();
  if (!s) return { error: "غير مصرح" };
  const db = await getTenantDb(s.storeId);
  const parsed = shippingTableSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };

  const rows = parsed.data.map((r) => ({
    storeId: s.storeId,
    governorate: r.governorate,
    feePiasters: egpToPiasters(r.fee),
    codExtraPiasters: egpToPiasters(r.codExtra),
    etaMinDays: r.etaMin,
    etaMaxDays: r.etaMax,
    isActive: r.isActive,
  }));

  const clear = db.delete(shippingZones).where(eq(shippingZones.storeId, s.storeId));
  if (rows.length) await db.batch([clear, db.insert(shippingZones).values(rows)]);
  else await clear;
  revalidatePath("/dashboard/shipping");
  return {};
}
