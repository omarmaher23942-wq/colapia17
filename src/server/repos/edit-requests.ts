import "server-only";
// edit-requests.ts — طلبات التعديل بعد التسليم (V4). يقرؤها صندوق المالك /admin/edits وبوابة العميل (عقد: EditRequestView).
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { editRequests, storeRequests } from "@/db/schema";
import type { EditStatus } from "@/db/schema/agency-constants";

export type EditRequestView = {
  id: string;
  storeName: string;
  clientEmail: string;
  title: string;
  details: string;
  repoUrl: string | null;
  status: string;
  free: boolean;
  // ─── تفاصيل إضافية للصندوق والبوابة ───
  code: string;
  requestId: string;
  storeUrl: string | null;
  files: { url: string; name: string }[];
  /** الرسوم بالجنيه (0 للمجاني). */
  feeEgp: number;
  paidAt: Date | null;
  teamNote: string | null;
  createdAt: Date;
  doneAt: Date | null;
};

const select = {
  e: editRequests,
  storeName: storeRequests.storeName,
  repoUrl: storeRequests.repoUrl,
  storeUrl: storeRequests.storeUrl,
};

type Joined = { e: typeof editRequests.$inferSelect; storeName: string | null; repoUrl: string | null; storeUrl: string | null };

const view = (r: Joined): EditRequestView => ({
  id: r.e.id,
  storeName: r.storeName ?? "",
  clientEmail: r.e.clientEmail,
  title: r.e.title,
  details: r.e.details,
  repoUrl: r.repoUrl,
  status: r.e.status,
  free: r.e.isFree,
  code: r.e.code,
  requestId: r.e.requestId,
  storeUrl: r.storeUrl,
  files: Array.isArray(r.e.files) ? r.e.files : [],
  feeEgp: Math.round(r.e.feePiasters / 100),
  paidAt: r.e.paidAt,
  teamNote: r.e.teamNote,
  createdAt: r.e.createdAt,
  doneAt: r.e.doneAt,
});

export async function getEditRequest(id: string): Promise<EditRequestView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [r] = await db.select(select).from(editRequests).innerJoin(storeRequests, eq(storeRequests.id, editRequests.requestId)).where(eq(editRequests.id, id)).limit(1);
  return r ? view(r) : null;
}

/** صندوق المالك: الأحدث أولاً. status = "open" كل ما لم يُنجز بعد (جديد/بانتظار الدفع/قيد التنفيذ). */
export async function listEditRequests(opts: { status?: EditStatus | "open" | "all"; requestId?: string; limit?: number } = {}): Promise<EditRequestView[]> {
  const status = opts.status ?? "open";
  const rows = await db
    .select(select)
    .from(editRequests)
    .innerJoin(storeRequests, eq(storeRequests.id, editRequests.requestId))
    .where(
      and(
        status === "all" ? undefined : status === "open" ? inArray(editRequests.status, ["new", "awaiting_payment", "in_progress"]) : eq(editRequests.status, status),
        opts.requestId ? eq(editRequests.requestId, opts.requestId) : undefined
      )
    )
    .orderBy(desc(editRequests.createdAt))
    .limit(opts.limit ?? 200);
  return rows.map(view);
}

/** عدد الطلبات المفتوحة لشارة القائمة الجانبية. */
export async function openEditCount(): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(editRequests)
    .where(inArray(editRequests.status, ["new", "in_progress"]))
    .catch(() => [{ n: 0 }]);
  return r?.n ?? 0;
}

/** تعديلات مشروع بعينه (للعميل في بوابته). */
export async function editsOfRequest(requestId: string): Promise<EditRequestView[]> {
  return listEditRequests({ status: "all", requestId, limit: 100 });
}

/** هل استُهلك التعديل المجاني لهذا المشروع؟ (أي طلب مجاني لم يُعتذر عنه). */
export async function freeEditUsed(requestId: string): Promise<boolean> {
  const [r] = await db
    .select({ id: editRequests.id })
    .from(editRequests)
    .where(and(eq(editRequests.requestId, requestId), eq(editRequests.isFree, true), ne(editRequests.status, "declined")))
    .limit(1);
  return Boolean(r);
}
