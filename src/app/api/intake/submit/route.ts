// إرسال استمارة طلب المتجر. بالترتيب: نفس المصدر ← حد المعدل ← الطلب مسودة مفتوحة ← فخ البرامج الآلية (الحقل
// المخفي: قبول صامت بلا طلب؛ الإرسال الأسرع من إنسان: انتظار وإعادة) ← شروط الاستمارة ← ملكية كل ملف مذكور ← حماية الإساءة ← إرسال مرة واحدة ← بريد بعد الرد.
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { conversations } from "@/db/schema";
import { intakeDataSchema, normalizeEmail, referencedKeys, validateSubmission } from "@/intake/schema";
import { draftIsOpen, findByDraftToken, isMissingTable, openQueueLength, requestAssets, submitRequest } from "@/intake/repo";
import { filledHoneypot, hit, intakeSettings, json, requestIp, reserveIntake, sameOrigin, submitWaitMs } from "@/intake/guard";
import { estimateEta, etaText } from "@/intake/eta";
import { readJson } from "@/intake/http";
import { derivedToken, randomToken } from "@/intake/tokens";
import { notifySubmitted } from "@/intake/notify";
import { isTrustedUploadUrl } from "@/lib/upload-hosts";
import { normalizeEgyptianPhone } from "@/lib/phone";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";

const followPath = (id: string) => `/follow/${derivedToken("track", id)}?new=1`;

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const ip = requestIp(req);
  if (!(await hit(`submit:ip:${ip}`, 12, 600))) return json({ error: "rate_limited", message: "محاولات كتير، جرّب بعد دقائق." }, 429);

  const parsedBody = await readJson(req);
  if (!parsedBody.ok) return json({ error: "bad_request" }, parsedBody.status);
  const { token, data: rawData, hp } = parsedBody.body;
  const parsed = intakeDataSchema.safeParse(rawData ?? {});
  if (!parsed.success) return json({ error: "invalid", message: "في بيانات مش مقبولة في الاستمارة." }, 400);
  const data = parsed.data;

  try {
    const row = await findByDraftToken(token);
    if (!row) return json({ error: "not_found", message: "الرابط غير صحيح. حدّث الصفحة." }, 404);
    // إرسال مكرر (ضغطتان، أو شبكة ضعيفة أعادت الطلب): نفس النتيجة بلا طلب جديد.
    if (row.status === "submitted" || row.status === "converted") return json({ ok: true, already: true, code: row.code, followUrl: followPath(row.id) });
    if (!draftIsOpen(row)) return json({ error: "expired", message: "انتهت مهلة المسودة. ابدأ استمارة جديدة." }, 410);

    const settings = await intakeSettings();
    if (!settings.enabled) return json({ error: "closed", message: "استقبال الطلبات متوقف مؤقتاً. كلّمنا مباشرة." }, 503);

    if (filledHoneypot(hp)) {
      log.warn("security", "intake_blocked", { requestId: row.id, reason: "honeypot" });
      return json({ ok: true, code: row.code, followUrl: `/follow/${randomToken()}?new=1` });
    }
    const wait = submitWaitMs(row.createdAt);
    if (wait > 0) return json({ ok: false, error: "too_fast", retryAfterMs: wait + 250 }, 202);

    const errors = validateSubmission(data);
    if (Object.keys(errors).length) return json({ error: "invalid", errors }, 422);

    // كل ملف مذكور يجب أن يكون مرفوعاً لهذا الطلب نفسه وبنوعه الصحيح ومن مضيف UploadThing.
    const assets = await requestAssets(row.id);
    const byKey = new Map(assets.map((a) => [a.key, a]));
    const keys = referencedKeys(data);
    const owned = (key: string | null, kind: "image" | "logo" | "voice") => {
      if (!key) return true;
      const a = byKey.get(key);
      return Boolean(a && a.kind === kind && isTrustedUploadUrl(a.url));
    };
    if (!keys.images.every((k) => owned(k, "image")) || !owned(keys.logo, "logo") || !owned(keys.voice, "voice")) {
      return json({ error: "files", message: "في صورة أو تسجيل لم يكتمل رفعه. احذفه وارفعه تاني." }, 422);
    }

    const email = normalizeEmail(data.contact.email);
    const whatsapp = normalizeEgyptianPhone(data.contact.whatsapp ?? null);
    const decision = await reserveIntake({ ip, email, whatsapp, limits: settings.limits });
    if (!decision.ok) return json({ error: "limited", reason: decision.reason, message: decision.message }, 429);

    const eta = estimateEta(await openQueueLength(), settings.capacityPerDay);
    const now = Date.now();
    const done = await submitRequest(row, { data, etaFrom: new Date(now + eta.fromHours * 3_600_000), etaTo: new Date(now + eta.toHours * 3_600_000) });
    if (!done) {
      const again = await findByDraftToken(token);
      if (again && again.status !== "draft") return json({ ok: true, already: true, code: again.code, followUrl: followPath(again.id) });
      return json({ error: "expired", message: "انتهت مهلة المسودة. ابدأ استمارة جديدة." }, 410);
    }

    if (done.conversationId) {
      await db.update(conversations).set({ stage: "form_submitted" }).where(eq(conversations.id, done.conversationId)).catch(() => {});
    }
    after(() => notifySubmitted(done, data, assets).catch((e) => console.error("[intake] notify failed", e)));

    return json({ ok: true, code: done.code, followUrl: followPath(done.id), eta: { ...eta, text: etaText(eta) } });
  } catch (e) {
    if (isMissingTable(e)) return json({ error: "unavailable", message: "الاستمارة بتتجهز، جرّب بعد قليل." }, 503);
    console.error("[intake/submit]", e);
    return json({ error: "server", message: "حصل خطأ أثناء الإرسال. بياناتك محفوظة، جرّب تاني." }, 500);
  }
}
