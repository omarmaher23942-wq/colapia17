// POST /api/client-error — يستقبل أخطاء المتصفح غير المعالجة من ErrorReporter ويحفظها في system_events (scope=client)
// ليراها المالك في «جاهزية الإطلاق». نفس الأصل فقط، بحد معدل، وبلا أسرار (تنقية في cleanClientError).
import { allow, clientIp } from "@/lib/ratelimit";
import { cleanClientError } from "@/lib/client-report";
import { db } from "@/db/client";
import { systemEvents } from "@/db/schema";
import { readRequestId } from "@/lib/correlation";
import { apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

function sameOrigin(req: Request): boolean {
  const o = req.headers.get("origin");
  const h = req.headers.get("host");
  if (!o || !h) return false;
  try { return new URL(o).host === h; } catch { return false; }
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return apiError("forbidden", "غير مصرح.", 403);
  const ip = clientIp(req.headers);
  if (!(await allow("report", `err:${ip}`))) return new Response(null, { status: 204 });
  const text = await req.text().catch(() => "");
  if (text.length > 4000) return apiError("bad_request", "طلب كبير.", 413);
  let body: unknown = null;
  try { body = JSON.parse(text); } catch { /* يُرفض أدناه */ }
  const e = cleanClientError(body);
  if (!e) return new Response(null, { status: 204 });
  const reqId = await readRequestId();
  await db.insert(systemEvents).values({ level: "error", scope: "client", actor: "browser", message: e.message, data: { reqId, path: e.path, kind: e.kind, stack: e.stack } }).catch(() => {});
  return new Response(null, { status: 204 });
}
