"use server";
// provision-request.ts — «جهّز المتجر وولّد رابط الإعداد» على /admin/requests/[id] (V5 N6) و«أعيدوا إرسال رابط إعداد».
// الصلاحية: requests.deliver (المالك والمدير) أو المنفّذ المسند للطلب. الرابط موقّع ويُعاد توليده دون تخزين.
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { storeRequestEvents, storeRequests } from "@/db/schema/agency";
import { getPlatformSession } from "@/server/auth";
import { can, isPlatformRole } from "@/agency/roles";
import { logActivity } from "@/agency/activity";
import { provisionFromRequest } from "@/agency/provision";
import { handoffInputFor } from "@/agent/handoff-data";
import { handoffMessage } from "@/agent/handoff-messages";

export type SetupLinkResult = { ok: true; slug?: string; source?: "folder" | "default"; products?: number; setupUrl: string; message: string } | { ok: false; error: string };

const schema = z.object({ id: z.string().uuid(), slug: z.string().max(40).nullish() });

async function allowed(id: string) {
  const u = await getPlatformSession();
  if (!u || !isPlatformRole(u.role)) return null;
  const [row] = await db.select().from(storeRequests).where(eq(storeRequests.id, id)).limit(1);
  if (!row) return null;
  const ok = can(u.role, "requests.deliver") || (row.builderId === u.id && can(u.role, "requests.work"));
  return ok ? { user: u, row } : null;
}

async function linkFor(storeId: string): Promise<{ setupUrl: string; message: string } | null> {
  const h = await handoffInputFor(storeId);
  return h ? { setupUrl: h.setupUrl, message: handoffMessage("setup", h) } : null;
}

export async function provisionRequestAction(raw: z.input<typeof schema>): Promise<SetupLinkResult> {
  const p = schema.safeParse(raw);
  if (!p.success) return { ok: false, error: "بيانات غير صالحة." };
  const a = await allowed(p.data.id);
  if (!a) return { ok: false, error: "غير مصرح لهذا الدور." };

  const res = await provisionFromRequest(a.row, p.data.slug?.trim() || null);
  if (!res.ok) return res;
  const link = await linkFor(res.storeId);
  if (!link) return { ok: false, error: "جُهِّز المتجر لكن تعذّر توليد الرابط. استخدموا «أعيدوا إرسال رابط إعداد»." };

  await db
    .insert(storeRequestEvents)
    .values({ requestId: a.row.id, type: "provision", actor: `platform:${a.user.id}`, internalNote: `جُهِّز المتجر ${res.slug} (${res.source === "folder" ? "من مجلد الفريق" : "مخطط افتراضي"}) بحالة إعداد` })
    .catch(() => {});
  await logActivity(a.user.id, "request.provision", a.row.id, { slug: res.slug, source: res.source }).catch(() => {});
  revalidatePath(`/admin/requests/${a.row.id}`);
  return { ok: true, slug: res.slug, source: res.source, products: res.products, ...link };
}

/** رابط إعداد جديد صالح 14 يوماً لمتجر الطلب المجهَّز (الرابط القديم يبقى صالحاً حتى انتهائه). */
export async function reissueSetupLinkAction(raw: { id: string }): Promise<SetupLinkResult> {
  const p = z.object({ id: z.string().uuid() }).safeParse(raw);
  if (!p.success) return { ok: false, error: "بيانات غير صالحة." };
  const a = await allowed(p.data.id);
  if (!a) return { ok: false, error: "غير مصرح لهذا الدور." };
  if (!a.row.storeId) return { ok: false, error: "لم يُجهَّز متجر لهذا الطلب بعد." };
  const link = await linkFor(a.row.storeId);
  return link ? { ok: true, ...link } : { ok: false, error: "تعذّر توليد الرابط." };
}
