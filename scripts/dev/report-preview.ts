// report-preview.ts — يطبع نص التقرير الشهري لمتجر من بيانات المعاينة المحلية (للتجربة فقط، لا يرسل بريداً).
// الاستخدام: bash scripts/dev/preview.sh run node --require ./scripts/dev/no-server-only.cjs --import tsx scripts/dev/report-preview.ts nova
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { stores } from "@/db/schema";
import { storeReport } from "@/server/monthly-report";
import { reportMonth } from "@/lib/monthly-report";

async function main() {
const sub = process.argv[2] ?? "nova";
const [store] = await db.select().from(stores).where(eq(stores.subdomain, sub)).limit(1);
if (!store) throw new Error(`no store ${sub}`);
const month = reportMonth(new Date());
console.log(`— ${month.label} —`);
for (const p of await storeReport(store, month)) console.log(p);
}

void main().then(() => process.exit(0));
