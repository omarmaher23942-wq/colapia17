// تفريغ الرسالة الصوتية بعد رفعها، ليراه العميل ويصححه قبل الإرسال. الملف يجب أن يكون مسجلاً لنفس المسودة.
import { FILE_KEY_RE } from "@/intake/schema";
import { draftIsOpen, findByDraftToken, isMissingTable } from "@/intake/repo";
import { allowTranscription, json, requestIp, sameOrigin } from "@/intake/guard";
import { readJson } from "@/intake/http";
import { transcribeRequestVoice } from "@/intake/transcribe";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const parsedBody = await readJson(req, 2048);
  if (!parsedBody.ok) return json({ error: "bad_request" }, parsedBody.status);
  const { token, key } = parsedBody.body;
  if (typeof key !== "string" || !FILE_KEY_RE.test(key)) return json({ error: "bad_request" }, 400);
  try {
    const row = await findByDraftToken(token);
    if (!row || !draftIsOpen(row)) return json({ error: "not_found" }, 404);
    if (!(await allowTranscription(row.id, requestIp(req)))) {
      return json({ error: "rate_limited", message: "وصلت للحد من التفريغ الآلي. رسالتك محفوظة والفريق هيسمعها." }, 429);
    }
    const r = await transcribeRequestVoice(row.id, key);
    if (r.ok) return json({ ok: true, text: r.text });
    if (r.error === "not_found") return json({ error: "not_found" }, 404);
    return json({ ok: false, error: r.error, message: "ما قدرناش نحوّل التسجيل لنص، بس هو محفوظ والفريق هيسمعه." });
  } catch (e) {
    if (isMissingTable(e)) return json({ error: "unavailable" }, 503);
    console.error("[intake/transcribe]", e);
    return json({ error: "server" }, 500);
  }
}
