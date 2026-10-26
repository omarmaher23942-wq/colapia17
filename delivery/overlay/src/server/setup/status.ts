import "server-only";
// status.ts — حالة الإعداد الأول لصفحة /setup: ما الذي رُبط وما الذي ينقص، بلغة تُقرأ مباشرة.
import { neon } from "@neondatabase/serverless";
import { resolveDatabaseUrl, siteOrigin } from "@/lib/env";
import { imagekitConfig, imagekitMissing } from "@/server/imagekit";
import { mediaBucket } from "@/server/cf-bindings";
import { providerKey } from "@/server/settings";
import { migrationState, type MigrationState } from "@/server/setup/migrate";

export type CheckLevel = "ok" | "missing" | "optional";
export type Check = { id: "database" | "images" | "ai" | "video" | "site" | "email"; label: string; level: CheckLevel; detail: string; fix?: string };

export type SetupStatus = {
  checks: Check[];
  dbReachable: boolean;
  dbError: string | null;
  migrations: MigrationState | null;
  ownerExists: boolean;
  storeExists: boolean;
};

async function dbProbe(): Promise<{ reachable: boolean; error: string | null; migrations: MigrationState | null; ownerExists: boolean; storeExists: boolean }> {
  const url = resolveDatabaseUrl();
  if (!url) return { reachable: false, error: null, migrations: null, ownerExists: false, storeExists: false };
  try {
    const sql = neon(url);
    await sql.query("select 1");
    const migrations = await migrationState();
    if (migrations.pending > 0 || migrations.total === 0) return { reachable: true, error: null, migrations, ownerExists: false, storeExists: false };
    const rows = (await sql.query("select (select count(*) from merchants where password_hash is not null) as owners, (select count(*) from stores where deleted_at is null) as stores")) as { owners: string; stores: string }[];
    return { reachable: true, error: null, migrations, ownerExists: Number(rows[0]?.owners) > 0, storeExists: Number(rows[0]?.stores) > 0 };
  } catch (e) {
    return { reachable: false, error: String((e as Error)?.message ?? e).slice(0, 200), migrations: null, ownerExists: false, storeExists: false };
  }
}

export async function setupStatus(): Promise<SetupStatus> {
  const [probe, groq, bucket] = await Promise.all([dbProbe(), providerKey("groq").catch(() => null), mediaBucket()]);
  const checks: Check[] = [];

  checks.push(
    !resolveDatabaseUrl()
      ? { id: "database", label: "قاعدة البيانات (Neon)", level: "missing", detail: "لم يُربط رابط القاعدة بعد.", fix: "أضيفوا المتغير DATABASE_URL في Cloudflare (Settings ← Variables and Secrets) بقيمة رابط الاتصال من Neon، ثم أعيدوا النشر." }
      : !probe.reachable
        ? { id: "database", label: "قاعدة البيانات (Neon)", level: "missing", detail: `تعذّر الاتصال: ${probe.error ?? "خطأ غير معروف"}`, fix: "تأكدوا أن الرابط منسوخ كاملاً (يبدأ بـ postgresql:// وينتهي بـ sslmode=require)." }
        : { id: "database", label: "قاعدة البيانات (Neon)", level: "ok", detail: "متصلة." }
  );

  const missing = imagekitMissing();
  checks.push(
    imagekitConfig()
      ? { id: "images", label: "الصور (ImageKit)", level: "ok", detail: "جاهزة لرفع صور المنتجات والشعار." }
      : { id: "images", label: "الصور (ImageKit)", level: "missing", detail: `ناقص: ${missing.join("، ")}`, fix: "من imagekit.io ← Developer options ← API keys: انسخوا المفتاح الخاص إلى IMAGEKIT_PRIVATE_KEY ونقطة النهاية (URL endpoint) إلى IMAGEKIT_URL_ENDPOINT." }
  );

  checks.push(
    groq
      ? { id: "ai", label: "الميزات الذكية (Groq)", level: "ok", detail: "مفعّلة: قراءة صور المنتجات، الأوصاف، مساعد التصميم." }
      : { id: "ai", label: "الميزات الذكية (Groq)", level: "optional", detail: "غير مفعّلة. المتجر واللوحة يعملان كاملين، وتتعطل قراءة الصور والأوصاف الذكية فقط.", fix: "أضيفوا GROQ_API_KEY من console.groq.com/keys، أو أدخلوه لاحقاً من لوحة التحكم ← الربط والمفاتيح." }
  );

  checks.push(
    bucket
      ? { id: "video", label: "فيديو الواجهة (R2)", level: "ok", detail: "الحاوية MEDIA مربوطة." }
      : { id: "video", label: "فيديو الواجهة (R2)", level: "optional", detail: "حاوية MEDIA غير مربوطة، فلا يمكن رفع فيديو الواجهة (الصور وبقية المتجر تعمل).", fix: "أنشئوا حاوية R2 باسم <المعرّف>-media كما في docs/SETUP.md ثم أعيدوا النشر." }
  );

  checks.push(
    siteOrigin()
      ? { id: "site", label: "رابط الموقع", level: "ok", detail: siteOrigin() }
      : { id: "site", label: "رابط الموقع", level: "optional", detail: "لم يُضبط APP_URL بعد. روابط الخريطة والمشاركة تحتاجه.", fix: "بعد ربط النطاق أضيفوا APP_URL برابط الموقع كما يفتحه الزوار (بلا / في الآخر)." }
  );

  checks.push(
    process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim()
      ? { id: "email", label: "البريد", level: "ok", detail: "إشعارات الطلبات بالبريد مفعّلة." }
      : { id: "email", label: "البريد", level: "optional", detail: "غير مفعّل (اختياري). إشعارات الطلبات تظهر في اللوحة.", fix: "لتفعيله أضيفوا RESEND_API_KEY وEMAIL_FROM." }
  );

  return { checks, dbReachable: probe.reachable, dbError: probe.error, migrations: probe.migrations, ownerExists: probe.ownerExists, storeExists: probe.storeExists };
}
