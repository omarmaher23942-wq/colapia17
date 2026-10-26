// open-next.config.ts — بناء مشروعك لـ Cloudflare Workers (OpenNext). كل الصفحات ديناميكية بلا ذاكرة صفحات (ISR)،
// والذاكرة المؤقتة داخل العملية (src/lib/redis.ts)، فلا يلزم bucket إضافي ولا Durable Objects.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
