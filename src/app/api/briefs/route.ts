// POST /api/briefs — استقبال استمارة «موقعكم العقاري» (colapia.com/realestate).
// نفس الأصل فقط، بحد معدل لكل عنوان، وحقل مخفي للبرامج الآلية، وتحقق كامل بقواعد الاستمارة نفسها (src/briefs/realestate.ts).
// المعرّف من المتصفح فإعادة الإرسال آمنة، والحفظ بطرق احتياطية متعددة (src/server/briefs.ts) فلا تضيع استمارة.
import { createHash } from "node:crypto";
import { allow, clientIp } from "@/lib/ratelimit";
import { apiError } from "@/lib/api-response";
import { readRequestId } from "@/lib/correlation";
import { getPlatformSession } from "@/server/auth";
import { saveBrief, newBriefRef } from "@/server/briefs";
import { parseBrief } from "@/briefs/realestate";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** أقل من هذا من بدء الاستمارة = برنامج آلي (سبع خطوات لا تُملأ في ثوانٍ). */
const MIN_FILL_MS = 6_000;

function sameOrigin(req: Request): boolean {
  const o = req.headers.get("origin");
  const h = req.headers.get("host");
  if (!o || !h) return false;
  try {
    return new URL(o).host === h;
  } catch {
    return false;
  }
}

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);

export async function POST(req: Request) {
  const reqId = await readRequestId();
  if (!sameOrigin(req)) return apiError("forbidden", "غير مصرح.", 403, reqId);
  const ip = clientIp(req.headers);
  if (!(await allow("brief", `brief:${ip}`))) {
    return apiError("rate_limited", "أرسلتم استمارات كثيرة خلال وقت قصير. حاولوا بعد قليل.", 429, reqId, { "Retry-After": "600" });
  }

  const raw = await req.text().catch(() => "");
  if (raw.length > 40_000) return apiError("too_large", "الاستمارة أكبر من المسموح.", 413, reqId);
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return apiError("bad_request", "طلب غير صالح.", 400, reqId);
  }

  const id = typeof body.id === "string" && UUID.test(body.id) ? body.id.toLowerCase() : null;
  if (!id) return apiError("bad_request", "طلب غير صالح.", 400, reqId);

  // برنامج آلي: الحقل المخفي مملوء أو إرسال فوري. رد نجاح شكلي بلا حفظ (لا نكشف له السبب).
  const startedAt = typeof body.startedAt === "number" ? body.startedAt : 0;
  if ((typeof body.website === "string" && body.website.trim()) || (startedAt && Date.now() - startedAt < MIN_FILL_MS)) {
    return Response.json({ ok: true, ref: newBriefRef() }, { headers: { "Cache-Control": "no-store" } });
  }

  const parsed = parseBrief(body.data);
  if (!parsed.ok) {
    return Response.json({ ok: false, code: "invalid", error: "بعض الإجابات تحتاج مراجعة.", step: parsed.step, errors: parsed.errors, reqId }, { status: 422 });
  }

  // من يرسل وهو داخل لوحة المالك = استمارة تجريبية (تظهر في اللوحة بوسم «تجريبية» ولا يصل العميل بريد تأكيد).
  const isTest = Boolean(await getPlatformSession().catch(() => null));
  const meta = {
    reqId,
    ipHash: createHash("sha256").update(`brief:${ip}`).digest("hex").slice(0, 16),
    ua: clip(req.headers.get("user-agent"), 200),
    referrer: clip(body.referrer, 300),
    source: clip(body.source, 120),
    fillSeconds: startedAt ? Math.round((Date.now() - startedAt) / 1000) : undefined,
    country: clip(req.headers.get("cf-ipcountry"), 4),
  };

  const res = await saveBrief({ id, data: parsed.data, meta, isTest });
  if (!res.ok) return apiError("unavailable", "تعذر حفظ الاستمارة الآن. بياناتكم محفوظة على جهازكم، أعيدوا المحاولة بعد لحظات.", 503, reqId);
  return Response.json({ ok: true, ref: res.ref }, { headers: { "Cache-Control": "no-store" } });
}
