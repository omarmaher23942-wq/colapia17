"use server";
// change-requests.ts — «اطلب تعديل» من لوحة التاجر (المرحلة 9): حصة شهرية (افتراضياً 2، من /admin/flags ← change_requests)،
// والطلب يصل للفريق ببريد وتنبيه، ويظهر في لوحة الوكالة (/admin/changes).
import { revalidatePath } from "next/cache";
import { and, count, eq, gte, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { storeChangeRequests } from "@/db/schema";
import { storeFor } from "@/server/merchant-guard";
import { CHANGE_AREAS, cairoMonthStart, perMonthFrom, remainingQuota } from "@/lib/change-requests";
import { getFlag } from "@/lib/flags";
import { notifyAdmin } from "@/ai/lifecycle/notify";
import { emailMembers, managerIds } from "@/agency/notify";
import { clientEnv } from "@/lib/env";

const schema = z.object({ area: z.enum(CHANGE_AREAS), body: z.string().trim().min(10, "اشرح التعديل في جملة على الأقل.").max(2000) });

export async function quotaFor(storeId: string): Promise<{ perMonth: number; used: number; remaining: number }> {
  const [f, [r]] = await Promise.all([
    getFlag<Record<string, unknown>>("change_requests").catch(() => ({ enabled: true, config: null })),
    db
      .select({ n: count() })
      .from(storeChangeRequests)
      .where(and(eq(storeChangeRequests.storeId, storeId), ne(storeChangeRequests.status, "declined"), gte(storeChangeRequests.createdAt, cairoMonthStart()))),
  ]);
  const perMonth = perMonthFrom(f.config);
  const used = Number(r?.n ?? 0);
  return { perMonth, used, remaining: remainingQuota(used, perMonth) };
}

export async function submitChangeRequestAction(raw: z.input<typeof schema>): Promise<{ ok: true } | { ok: false; error: string }> {
  const s = await storeFor("requests");
  if (!s) return { ok: false, error: "غير مصرح لدورك." };
  if (!["trial", "active"].includes(s.store.status)) return { ok: false, error: "الطلبات بعد تسليم المتجر." };
  const p = schema.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "بيانات غير صالحة" };
  const q = await quotaFor(s.storeId);
  if (q.remaining <= 0) return { ok: false, error: `استخدمت طلبات هذا الشهر (${q.perMonth}). تتجدد أول الشهر، ولأي أمر عاجل تواصل معنا.` };
  await db.insert(storeChangeRequests).values({ storeId: s.storeId, merchantId: s.merchantId, area: p.data.area, body: p.data.body });
  const msg = `طلب تعديل جديد من متجر ${s.store.name} (${s.store.subdomain}): ${p.data.body.slice(0, 160)}`;
  await notifyAdmin(msg, { storeId: s.storeId }).catch(() => {});
  await emailMembers(await managerIds(), { subject: `طلب تعديل: ${s.store.name}`, headline: "طلب تعديل جديد", lines: [msg], requestId: "", href: new URL("/admin/changes", clientEnv.NEXT_PUBLIC_APP_URL).toString() }).catch(() => 0);
  revalidatePath("/dashboard/requests");
  return { ok: true };
}
