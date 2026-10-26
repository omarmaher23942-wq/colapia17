// يُشعر IndexNow بصفحات المنصة بعد كل نشر مؤثر: npx tsx scripts/seo/indexnow-ping.ts [https://colapia.com]
import { pingIndexNow } from "../../src/lib/platform-indexnow";
import { siteOrigin } from "../../src/lib/platform-seo";

const origin = process.argv[2] ?? siteOrigin();
const r = await pingIndexNow(origin);
console.log(r.ok ? `تم إشعار IndexNow بـ ${r.submitted} صفحة (${r.status})` : `تعذّر الإشعار (الحالة ${r.status}، الصفحات ${r.submitted}). تأكدوا أن ${origin}/<المفتاح>.txt يعمل.`);
process.exit(r.ok ? 0 : 1);
