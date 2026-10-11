// run-job.ts — يشغّل معالج مهمة دورة حياة واحدة على متجر في القاعدة المحلية (لا QStash محلياً)، لتجربة الإيقاف
// والتنبيه الأخير والحذف دون انتظار مواعيدها. للتطوير فقط.
//   bash scripts/dev/preview.sh job <subdomain> <kind>      مثال: job layan trial.freeze
import { eq } from "drizzle-orm";
import { db } from "../../src/db/client";
import { stores } from "../../src/db/schema";
import { HANDLERS } from "../../src/lifecycle/handlers";
import { JOB_KINDS, type JobKind } from "../../src/lifecycle/scheduler";

async function main() {
  const [sub, kind] = process.argv.slice(2);
  if (!/@[^/]+\.local\.neon\//.test(process.env.DATABASE_URL ?? "")) throw new Error("محلياً فقط");
  if (!sub || !JOB_KINDS.includes(kind as JobKind)) throw new Error(`الاستخدام: run-job.ts <subdomain> <${JOB_KINDS.join("|")}>`);
  const [s] = await db.select().from(stores).where(eq(stores.subdomain, sub)).limit(1);
  if (!s) throw new Error("المتجر غير موجود");
  console.log(JSON.stringify(await HANDLERS[kind as JobKind](s), null, 2));
}
main().then(() => process.exit(0), (e) => { console.error("✗", e instanceof Error ? e.message : e); process.exit(1); });
