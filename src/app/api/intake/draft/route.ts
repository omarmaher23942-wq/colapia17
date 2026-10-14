// الحفظ التلقائي لاستمارة طلب المتجر: أول تعديل حقيقي ينشئ المسودة ويعيد رابطها السري، وكل حفظ بعده بنسخة
// متفائلة (409 بنسخة الخادم عند التعارض). بلا تسجيل دخول: الهوية = رابط المسودة.
import { intakeDataSchema } from "@/intake/schema";
import { createDraft, draftIsOpen, findByDraftToken, isMissingTable, saveDraft } from "@/intake/repo";
import { hit, intakeSettings, json, requestIp, sameOrigin } from "@/intake/guard";
import { cleanUtm, readJson } from "@/intake/http";
import { hashIp } from "@/intake/tokens";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const ip = requestIp(req);
  if (!(await hit(`draft:ip:${ip}`, 240, 60))) return json({ error: "rate_limited", message: "حفظ كتير في وقت قصير، انتظر ثانية." }, 429);

  const parsedBody = await readJson(req);
  if (!parsedBody.ok) return json({ error: "bad_request" }, parsedBody.status);
  const { token, version, data: rawData, utm } = parsedBody.body;
  const data = intakeDataSchema.safeParse(rawData ?? {});
  if (!data.success) return json({ error: "invalid", message: "في بيانات مش مقبولة في الاستمارة." }, 400);

  try {
    if (token === undefined || token === null) {
      const settings = await intakeSettings();
      if (!settings.enabled) return json({ error: "closed", message: "استقبال الطلبات متوقف مؤقتاً. كلّمنا مباشرة." }, 503);
      if (!(await hit(`create:ip:${ip}`, 60, 3600))) return json({ error: "rate_limited", message: "محاولات كثيرة من الشبكة نفسها، أعيدوا المحاولة بعد قليل." }, 429);
      const { row, token: newToken } = await createDraft({
        data: data.data,
        utm: cleanUtm(utm),
        ipHash: ip === "0.0.0.0" ? null : hashIp(ip),
        userAgent: req.headers.get("user-agent"),
      });
      return json({ ok: true, token: newToken, version: row.draftVersion, code: row.code });
    }

    const row = await findByDraftToken(token);
    if (!row) return json({ error: "not_found", message: "الرابط غير صحيح." }, 404);
    if (row.status !== "draft") return json({ error: "submitted" }, 409);
    if (!draftIsOpen(row)) return json({ error: "expired", message: "انتهت مهلة المسودة. ابدأ استمارة جديدة." }, 410);
    if (!(await hit(`draft:req:${row.id}`, 120, 60))) return json({ error: "rate_limited" }, 429);
    if (!Number.isInteger(version)) return json({ error: "bad_request" }, 400);

    const saved = await saveDraft(row, version as number, data.data);
    if (saved.ok) return json({ ok: true, version: saved.version });
    if (saved.reason === "conflict") return json({ error: "conflict", version: saved.version, data: saved.data }, 409);
    if (saved.reason === "submitted") return json({ error: "submitted" }, 409);
    return json({ error: "expired" }, 410);
  } catch (e) {
    if (isMissingTable(e)) return json({ error: "unavailable", message: "الاستمارة بتتجهز، جرّب بعد قليل." }, 503);
    console.error("[intake/draft]", e);
    return json({ error: "server", message: "حصل خطأ في الحفظ، هنحاول تاني." }, 500);
  }
}
