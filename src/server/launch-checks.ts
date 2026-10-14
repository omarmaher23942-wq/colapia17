import "server-only";
// launch-checks.ts — مركز جاهزية الإطلاق (/admin/launch): فحص حي لكل خدمة ومفتاح تعتمد عليه المنصة، بنتيجة صريحة
// وسبب حقيقي وخطوة إصلاح بالعربية. كل فحص مستقل بمهلة قصيرة، وفشل أحدها لا يوقف الباقي. لا يطبع أي قيمة سرية.
import { sql, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { aiCalls } from "@/db/schema";
import { env } from "@/lib/env";
import { redis } from "@/lib/redis";
import { readTrace } from "@/lib/meta-trace";
import { mediaBaseUrl } from "@/lib/media";
import { MODELS } from "@/ai/providers";
import { domainAutoConfigured, domainTarget } from "@/server/domains";
import { deleteObjects, headObject, putObject, r2Configured, r2Missing } from "@/server/r2";
import journal from "../../drizzle/meta/_journal.json";

export type CheckStatus = "ok" | "warn" | "fail" | "skip";
export type Check = { id: string; label: string; status: CheckStatus; detail: string; fix?: string };
export type CheckGroup = { title: string; checks: Check[] };

const TIMEOUT = 8_000;
const timed = (url: string, init: RequestInit = {}) => fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT), cache: "no-store" });
const errText = (e: unknown) => String((e as Error)?.message ?? e).slice(0, 200);

async function run(id: string, label: string, fn: () => Promise<Omit<Check, "id" | "label">>): Promise<Check> {
  try {
    return { id, label, ...(await fn()) };
  } catch (e) {
    return { id, label, status: "fail", detail: errText(e) };
  }
}

/** أين يعمل التطبيق الآن (للتوجيه الصحيح في نصوص الإصلاح). */
export function hostingName(): "cloudflare" | "vercel" | "node" {
  if (typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers") return "cloudflare";
  return process.env.VERCEL === "1" ? "vercel" : "node";
}
const varsWhere = () =>
  hostingName() === "cloudflare" ? "Cloudflare ← Workers & Pages ← colapia ← Settings ← Variables and Secrets" : "Vercel ← المشروع ← Settings ← Environment Variables";

const ago = (iso: string | null) => {
  if (!iso) return null;
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  return m < 60 ? `منذ ${m} دقيقة` : m < 48 * 60 ? `منذ ${Math.round(m / 60)} ساعة` : `منذ ${Math.round(m / 1440)} يوم`;
};

// ─── الفحوص ────────────────────────────────────────────────────────────────

const checkDb = () =>
  run("db", "قاعدة البيانات", async () => {
    const t0 = Date.now();
    await db.execute(sql`select 1`);
    return { status: "ok", detail: `متصلة (${Date.now() - t0}ms)` };
  });

const checkMigrations = () =>
  run("migrations", "تحديثات قاعدة البيانات (migrations)", async () => {
    const rows = (await db.execute(sql`select max(created_at)::text as last from drizzle.__drizzle_migrations`).catch(() => null)) as
      | { rows?: { last: string | null }[] }
      | { last: string | null }[]
      | null;
    const list = Array.isArray(rows) ? rows : rows?.rows ?? [];
    const last = Number(list[0]?.last ?? 0);
    const pending = journal.entries.filter((e) => e.when > last).map((e) => e.tag);
    if (!pending.length) return { status: "ok", detail: `كلها مطبّقة (${journal.entries.length})` };
    return {
      status: "fail",
      detail: `غير مطبّق: ${pending.join("، ")}`,
      fix: "على جهازك في مجلد المشروع: git pull origin main ثم npm run db:migrate",
    };
  });

const checkRedis = () =>
  run("redis", "Redis (الذاكرة المؤقتة والحدود)", async () => {
    const key = `launch:ping:${Date.now()}`;
    await redis.set(key, "1", { ex: 30 });
    const v = await redis.get(key);
    return v ? { status: "ok", detail: "يعمل" } : { status: "fail", detail: "لم تُقرأ القيمة المكتوبة", fix: `راجع UPSTASH_REDIS_REST_URL وUPSTASH_REDIS_REST_TOKEN في ${varsWhere()}` };
  });

const checkEmail = () =>
  run("email", "البريد (Resend)", async () => {
    const from = /@([^>\s]+)/.exec(env.EMAIL_FROM)?.[1]?.toLowerCase() ?? env.ROOT_DOMAIN;
    const r = await timed("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` } });
    if (r.status === 401 || r.status === 403) return { status: "fail", detail: "المفتاح مرفوض", fix: `أنشئ مفتاحاً من resend.com/api-keys وضعه في RESEND_API_KEY (${varsWhere()})` };
    if (!r.ok) return { status: "warn", detail: `تعذر السؤال (${r.status})` };
    const body = (await r.json()) as { data?: { name: string; status: string }[] };
    const d = body.data?.find((x) => x.name.toLowerCase() === from);
    if (!d) return { status: "fail", detail: `النطاق ${from} غير مضاف في Resend`, fix: "resend.com/domains ← Add Domain ← أضف سجلاته في DNS" };
    return d.status === "verified"
      ? { status: "ok", detail: `${from} موثّق` }
      : { status: "fail", detail: `${from} حالته ${d.status}`, fix: "resend.com/domains ← افتح النطاق ← أضف السجلات الناقصة في DNS (كـ DNS only) ثم Verify" };
  });

const checkQstash = () =>
  run("qstash", "QStash (الرسائل المؤجلة)", async () => {
    const r = await timed(`${env.QSTASH_URL.replace(/\/$/, "")}/v2/schedules`, { headers: { Authorization: `Bearer ${env.QSTASH_TOKEN}` } });
    if (!r.ok) return { status: "fail", detail: `مرفوض (${r.status})`, fix: `راجع QSTASH_TOKEN في ${varsWhere()} (console.upstash.com ← QStash)` };
    const schedules = (await r.json()) as { destination?: string }[];
    const ops = schedules.filter((s) => /\/api\/ops\/(tick|sweep)/.test(s.destination ?? ""));
    if (ops.length && hostingName() === "cloudflare")
      return { status: "warn", detail: `يعمل، وفيه ${ops.length} جدول قديم لـ ops`, fix: "Cloudflare يشغّل المهام بنفسه: احذف جداول /api/ops من QStash ← Schedules حتى لا تعمل مرتين" };
    return { status: "ok", detail: "يعمل" };
  });

const checkCrons = () =>
  run("crons", "المهام المجدولة", async () => {
    const [tick, sweep] = await redis.mget<(string | null)[]>("ops:last:tick", "ops:last:sweep");
    const tickAge = tick ? Date.now() - new Date(tick).getTime() : Infinity;
    const sweepAge = sweep ? Date.now() - new Date(sweep).getTime() : Infinity;
    const detail = `اليومية: ${ago(tick ?? null) ?? "لم تعمل بعد"} · كل 10 دقائق: ${ago(sweep ?? null) ?? "لم تعمل بعد"}`;
    if (tickAge > 26 * 3600_000) return { status: "fail", detail, fix: hostingName() === "cloudflare" ? "تأكد من CRON_SECRET في الأسرار، وأن Settings ← Triggers فيها جدولان" : "Vercel ← Settings ← Cron Jobs مفعّلة، وCRON_SECRET مضبوط" };
    if (sweepAge > 60 * 60_000) return { status: "warn", detail, fix: hostingName() === "cloudflare" ? "تأكد من جدول */10 في Settings ← Triggers" : "على Vercel Hobby تعمل يومياً فقط؛ تعمل كل 10 دقائق بعد النقل لـ Cloudflare" };
    return { status: "ok", detail };
  });

const checkGroq = () =>
  run("groq", "Groq (الوكيل والبحث بالصورة والتفريغ)", async () => {
    const r = await timed("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` } });
    if (!r.ok) return { status: "fail", detail: `المفتاح مرفوض (${r.status})`, fix: `console.groq.com/keys ← مفتاح جديد في GROQ_API_KEY (${varsWhere()})` };
    const ids = new Set(((await r.json()) as { data?: { id: string }[] }).data?.map((m) => m.id) ?? []);
    const vision = [MODELS.groqVision, MODELS.groqVisionAlt].filter((m) => ids.has(m));
    if (!vision.length)
      return { status: "warn", detail: `المفتاح يعمل، لكن نماذج قراءة الصور (${MODELS.groqVision}) غير متاحة عليه`, fix: "اختر نموذج رؤية متاحاً من console.groq.com/docs/models وضعه في GROQ_VISION_MODEL؛ وإلا يعمل البحث بالصورة عبر Gemini" };
    return { status: "ok", detail: `يعمل · نموذج الصور: ${vision[0]}` };
  });

const checkGemini = () =>
  run("gemini", "Gemini (احتياط الصور وفحص الإيصالات)", async () => {
    const r = await timed(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(env.GEMINI_API_KEY)}&pageSize=200`);
    if (!r.ok) return { status: "fail", detail: `المفتاح مرفوض (${r.status})`, fix: `aistudio.google.com/apikey ← مفتاح جديد في GEMINI_API_KEY (${varsWhere()})` };
    const names = new Set(((await r.json()) as { models?: { name: string }[] }).models?.map((m) => m.name.replace(/^models\//, "")) ?? []);
    return names.has(MODELS.gemini)
      ? { status: "ok", detail: `يعمل · ${MODELS.gemini}` }
      : { status: "warn", detail: `المفتاح يعمل، لكن النموذج ${MODELS.gemini} غير موجود`, fix: `ضع في GEMINI_MODEL اسم نموذج flash متاح (مثل ${[...names].find((n) => /flash/.test(n)) ?? "gemini-…-flash"})` };
  });

const checkMedia = () =>
  run("media", "مساحة الصور", async () => {
    const missing = r2Missing();
    if (r2Configured()) {
      const host = new URL(mediaBaseUrl()!).hostname;
      const key = `tmp/launch-check-${Date.now()}.txt`;
      await putObject(key, new TextEncoder().encode("ok"), "text/plain");
      const head = await headObject(key);
      await deleteObjects([key]).catch(() => 0);
      return head
        ? { status: "ok", detail: `R2 يقبل الرفع والقراءة والحذف · الصور تُعرض من ${host}\nللتأكد من العرض نفسه اضغط «اختبر رفع الصور وعرضها» أعلاه.` }
        : { status: "fail", detail: "رُفع الملف ولم يُعثر عليه", fix: "راجع اسم الـ bucket في R2_BUCKET" };
    }
    if (missing.length && missing.length < 4)
      return { status: "fail", detail: `R2 مضبوط جزئياً وناقصه: ${missing.join("، ")}`, fix: `أضف المتغيرات الناقصة (${varsWhere()}) ثم أعد النشر. بدونها تُحفظ الصور على UploadThing إن وُجد.` };
    if (env.UPLOADTHING_TOKEN) {
      const { UTApi } = await import("uploadthing/server");
      const ok = await new UTApi({ token: env.UPLOADTHING_TOKEN }).listFiles({ limit: 1 }).then(() => true, () => false);
      return ok
        ? { status: "warn", detail: "الصور تُحفظ على UploadThing (يعمل)", fix: "R2 أسرع وأرخص: أضف R2_ACCOUNT_ID وR2_ACCESS_KEY_ID وR2_SECRET_ACCESS_KEY وR2_BUCKET (docs/deploy-cloudflare.md القسم 3)" }
        : { status: "fail", detail: "UPLOADTHING_TOKEN مرفوض: رفع الصور معطل", fix: `انسخ UPLOADTHING_TOKEN من uploadthing.com ← API Keys والصقه كما هو (${varsWhere()})، أو فعّل R2` };
    }
    return { status: "fail", detail: "لا R2 ولا UploadThing: رفع الصور معطل", fix: "أضف R2_ACCOUNT_ID وR2_ACCESS_KEY_ID وR2_SECRET_ACCESS_KEY وR2_BUCKET (docs/deploy-cloudflare.md القسم 3)" };
  });

const checkMeta = () =>
  run("meta", "فيسبوك وإنستجرام (الوكيل)", async () => {
    if (!env.META_PAGE_ACCESS_TOKEN && !env.META_INSTAGRAM_ACCESS_TOKEN) return { status: "skip", detail: "غير مربوط (الوكيل لا يرد على الرسائل)", fix: "docs/meta-agent.md" };
    const v = env.META_GRAPH_VERSION.startsWith("v") ? env.META_GRAPH_VERSION : `v${env.META_GRAPH_VERSION}`;
    // نفحص كل رمز يستخدمه الإرسال فعلاً: رمز الصفحة لماسنجر، ورمز إنستجرام (إن وُجد) يتقدم عليه في إنستجرام.
    const probe = async (tok: string) => {
      const host = /^IG/.test(tok) ? "graph.instagram.com" : "graph.facebook.com";
      const r = await timed(`https://${host}/${v}/me?fields=id,${host === "graph.instagram.com" ? "username" : "name"}&access_token=${encodeURIComponent(tok)}`);
      const body = (await r.json().catch(() => ({}))) as { name?: string; username?: string; error?: { message?: string; code?: number } };
      return r.ok ? { ok: true as const, name: body.name ?? body.username ?? "" } : { ok: false as const, error: `${body.error?.message?.slice(0, 140) ?? `مرفوض (${r.status})`}${body.error?.code ? ` (code ${body.error.code})` : ""}` };
    };
    const fixTok = (name: string) => `الرمز تالف أو منتهٍ أو منسوخ ناقصاً: أنشئ رمزاً جديداً من Meta والصقه في ${name} كما هو بلا تنصيص ولا مسافات، ثم أعد النشر (docs/meta-agent.md)`;
    const parts: string[] = [];
    if (env.META_PAGE_ACCESS_TOKEN) {
      const p = await probe(env.META_PAGE_ACCESS_TOKEN);
      if (!p.ok) return { status: "fail", detail: `رمز الصفحة مرفوض: ${p.error}`, fix: fixTok("META_PAGE_ACCESS_TOKEN") };
      parts.push(`الصفحة «${p.name}»`);
    }
    if (env.META_INSTAGRAM_ACCESS_TOKEN) {
      const p = await probe(env.META_INSTAGRAM_ACCESS_TOKEN);
      if (!p.ok) return { status: "fail", detail: `رمز إنستجرام مرفوض (وهو الذي يرد به الوكيل على إنستجرام): ${p.error}`, fix: `${fixTok("META_INSTAGRAM_ACCESS_TOKEN")}، أو احذفه ليُستخدم رمز الصفحة` };
      parts.push(`إنستجرام «${p.name}»`);
    }
    const missing = [!env.META_APP_SECRET && "META_APP_SECRET", !env.META_VERIFY_TOKEN && "META_VERIFY_TOKEN", !env.META_IG_ID && "META_IG_ID"].filter(Boolean);
    return missing.length
      ? { status: "warn", detail: `${parts.join(" و")} مربوطة، وناقص: ${missing.join("، ")}`, fix: "بدون META_APP_SECRET الصحيح تُرفض رسائل Meta بخطأ 401" }
      : { status: "ok", detail: `${parts.join(" و")} مربوطة` };
  });

const STEP_LABEL: Record<string, string> = {
  webhook: "وصل من ميتا",
  "webhook-401": "رُفض التوقيع (401)",
  "webhook-publish-failed": "فشل وضع الرسالة في الطابور",
  inbound: "بدأت المعالجة",
  "inbound-done": "انتهت المعالجة",
  "inbound-error": "فشلت المعالجة",
  "ai-fail": "فشل الذكاء الاصطناعي",
  "send-ok": "أُرسل الرد بنجاح",
  "send-fail": "فشل إرسال الرد",
  "reply-sent": "رد الوكيل وصل للعميل",
  skip: "لم يرد الوكيل",
  handoff: "حوّل الوكيل المحادثة لموظف",
  resume: "عاد الوكيل بعد مهلة التحويل",
  "direct-failed": "فشلت المعالجة المباشرة (أُرسلت للطابور)",
};

/** حالة الوكيل نفسه: هل هو مطفأ، وكم محادثة موقوفة عنه، وهل رابط الموقع يشير إلى هذا الخادم. */
const checkAgentState = () =>
  run("agent-state", "حالة وكيل الرسائل", async () => {
    const [{ isOn }, { conversations }] = await Promise.all([import("@/lib/flags"), import("@/db/schema")]);
    const [on, ig, paused] = await Promise.all([
      isOn("bot.enabled"),
      isOn("bot.instagram"),
      db.select({ n: sql<number>`count(*)::int` }).from(conversations).where(eq(conversations.botPaused, true)).then((r) => r[0]?.n ?? 0),
    ]);
    const appHost = (() => {
      try {
        return new URL(process.env.NEXT_PUBLIC_APP_URL ?? "").hostname;
      } catch {
        return "";
      }
    })();
    const problems = [
      !on && "الوكيل مطفأ (bot.enabled في /admin/flags)",
      !ig && "الوكيل مطفأ على إنستجرام (bot.instagram في /admin/flags)",
      paused > 0 && `${paused} محادثة موقوفة على «تدخل بشري» لن يرد فيها`,
      appHost && appHost !== env.ROOT_DOMAIN && !appHost.endsWith(`.${env.ROOT_DOMAIN}`) && `رابط الموقع NEXT_PUBLIC_APP_URL يشير إلى ${appHost} لا إلى ${env.ROOT_DOMAIN}`,
    ].filter(Boolean) as string[];
    return problems.length
      ? { status: !on || !ig ? "fail" : "warn", detail: problems.join(" · "), fix: "فعّل المفاتيح من /admin/flags، واضغط «استئناف الوكيل في كل المحادثات»، واجعل NEXT_PUBLIC_APP_URL = https://" + env.ROOT_DOMAIN + " ثم أعد النشر" }
      : { status: "ok", detail: "يعمل على ماسنجر وإنستجرام، ولا محادثات موقوفة" };
  });
const checkTrace = () =>
  run("meta-trace", "آخر ما حدث لرسائل الوكيل (الأحدث أولاً)", async () => {
    const rows = await readTrace();
    if (!rows.length) return { status: "skip", detail: "لا أحداث بعد: أرسل رسالة للصفحة ثم أعد الفحص", fix: undefined };
    const hasFail = rows.slice(0, 6).some((r) => /fail|error|401|skip/.test(r.step));
    const detail = rows
      .map((r) => `${ago(r.at) ?? ""} · ${STEP_LABEL[r.step] ?? r.step}${r.detail ? ` · ${r.detail}` : ""}`)
      .join("\n");
    return { status: hasFail ? "warn" : "ok", detail, fix: hasFail ? "سبب الفشل مكتوب في السطر نفسه" : undefined };
  });

const checkDomains = () =>
  run("domains", "النطاقات الخاصة للعملاء", async () => {
    const t = domainTarget();
    if (t.kind === "cloudflare") {
      if (!domainAutoConfigured()) return { status: "warn", detail: `يدوي (CNAME إلى ${t.cname})`, fix: "أضف CF_API_TOKEN ليُربط كل نطاق آلياً (الدليل القسم 8)" };
      const r = await timed("https://api.cloudflare.com/client/v4/user/tokens/verify", { headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` } });
      return r.ok ? { status: "ok", detail: `آلي عبر Cloudflare · CNAME إلى ${t.cname}` } : { status: "fail", detail: "توكن Cloudflare مرفوض", fix: "أنشئ توكناً بصلاحية SSL and Certificates: Edit (الدليل القسم 8)" };
    }
    return domainAutoConfigured() ? { status: "ok", detail: "آلي عبر Vercel" } : { status: "warn", detail: "يدوي: تضيف كل نطاق بنفسك ثم تؤكد" };
  });

const checkGithub = () =>
  run("github", "GitHub (فروع المتاجر وتسليم الكود)", async () => {
    if (!env.STORES_GITHUB_TOKEN || !env.STORES_GITHUB_REPO)
      return { status: hostingName() === "cloudflare" ? "fail" : "warn", detail: "غير مضبوط: التجهيز يعطي ZIP بدل فرع، و«نزّل مشروع المتجر» لا يعمل على Cloudflare", fix: "الدليل القسم 5 (توكن GitHub)" };
    const r = await timed(`https://api.github.com/repos/${env.STORES_GITHUB_REPO}`, { headers: { Authorization: `Bearer ${env.STORES_GITHUB_TOKEN}`, "User-Agent": "colapia" } });
    return r.ok ? { status: "ok", detail: `يصل إلى ${env.STORES_GITHUB_REPO}` } : { status: "fail", detail: `مرفوض (${r.status})`, fix: "التوكن منتهٍ أو بلا صلاحية Contents على المستودع" };
  });

function configChecks(): Check[] {
  const c = (id: string, label: string, ok: boolean, okDetail: string, failDetail: string, fix?: string, level: CheckStatus = "warn"): Check =>
    ok ? { id, label, status: "ok", detail: okDetail } : { id, label, status: level, detail: failDetail, fix };
  const where = varsWhere();
  return [
    c("google", "الدخول بـ Google", Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET), "مضبوط", "ناقص", `GOOGLE_CLIENT_ID/SECRET في ${where}`, "fail"),
    c("cron-secret", "سر المهام المجدولة", Boolean(env.CRON_SECRET), "مضبوط", "CRON_SECRET ناقص", `أضف نصاً عشوائياً طويلاً في ${where}`, hostingName() === "cloudflare" ? "fail" : "warn"),
    c("preview-key", "مفتاح معاينة الفريق", (process.env.STORE_PREVIEW_KEY ?? "").length >= 16, "مضبوط", "STORE_PREVIEW_KEY ناقص أو قصير", `16 حرفاً فأكثر في ${where} (لمعاينة المتاجر قبل التسليم)`),
    c("agency-whatsapp", "واتساب الوكالة للعملاء", Boolean(env.AGENCY_WHATSAPP), "مضبوط", "AGENCY_WHATSAPP ناقص: لا يظهر زر واتساب للعملاء في صفحات المتابعة", `رقمك بصيغة 01xxxxxxxxx في ${where}`),
    c("alerts", "بريد تنبيهاتك", Boolean(env.OWNER_ALERT_EMAILS), env.OWNER_ALERT_EMAILS, "OWNER_ALERT_EMAILS ناقص", undefined),
    c("payments", "أرقام التحويل", Boolean(env.VODAFONE_CASH_NUMBER && env.INSTAPAY_NUMBER), `فودافون كاش ${env.VODAFONE_CASH_NUMBER} · إنستاباي ${env.INSTAPAY_NUMBER}`, "ناقصة", undefined, "fail"),
  ];
}

export async function runLaunchChecks(): Promise<CheckGroup[]> {
  const [db1, mig, red, mail, q, cron, groq, gem, media, meta, metaTrace, dom, gh, agent] = await Promise.all([
    checkDb(), checkMigrations(), checkRedis(), checkEmail(), checkQstash(), checkCrons(), checkGroq(), checkGemini(), checkMedia(), checkMeta(), checkTrace(), checkDomains(), checkGithub(), checkAgentState(),
  ]);
  return [
    { title: "الأساس", checks: [db1, mig, red, cron, q] },
    { title: "البريد والرسائل", checks: [mail, meta, agent, metaTrace] },
    { title: "الذكاء الاصطناعي", checks: [groq, gem] },
    { title: "الصور والنطاقات والكود", checks: [media, dom, gh] },
    { title: "إعداداتك", checks: configChecks() },
  ];
}

/** آخر أخطاء الذكاء الاصطناعي (نص الخطأ الحقيقي من المزوّد) لكشف سبب أي ميزة متعطلة. */
export async function recentAiFailures(limit = 15) {
  return db
    .select({ at: aiCalls.createdAt, purpose: aiCalls.purpose, provider: aiCalls.provider, model: aiCalls.model, error: aiCalls.error })
    .from(aiCalls)
    .where(eq(aiCalls.ok, false))
    .orderBy(desc(aiCalls.createdAt))
    .limit(limit)
    .catch(() => []);
}
