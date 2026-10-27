// POST /api/vitals — قياسات الأداء الحقيقية (LCP/INP/CLS…) من زوار حقيقيين، بعيّنة 10% من الواجهة. تُحفظ في system_events
// (scope=perf) ويحسب منها مركز الإطلاق نسبة p75 مقابل حدود «جيد».
import { allow, clientIp } from "@/lib/ratelimit";
import { cleanVital } from "@/lib/client-report";
import { db } from "@/db/client";
import { systemEvents } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const o = req.headers.get("origin");
  const h = req.headers.get("host");
  try { if (!o || !h || new URL(o).host !== h) return new Response(null, { status: 204 }); } catch { return new Response(null, { status: 204 }); }
  if (!(await allow("report", `vit:${clientIp(req.headers)}`))) return new Response(null, { status: 204 });
  const text = await req.text().catch(() => "");
  if (text.length > 1000) return new Response(null, { status: 204 });
  let body: unknown = null;
  try { body = JSON.parse(text); } catch { /* تجاهل */ }
  const v = cleanVital(body);
  if (v) await db.insert(systemEvents).values({ level: "info", scope: "perf", actor: "browser", message: v.name, data: { value: v.value, path: v.path } }).catch(() => {});
  return new Response(null, { status: 204 });
}
