// open-next.config.ts — بناء Colapia لـ Cloudflare Workers (OpenNext). لا ذاكرة صفحات (ISR): كل الصفحات ديناميكية،
// والذاكرة المؤقتة في Redis (lib/redis.ts `cached`)، فلا يلزم bucket إضافي ولا Durable Objects.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
