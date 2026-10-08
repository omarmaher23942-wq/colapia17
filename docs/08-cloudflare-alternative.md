# النشر على Cloudflare Workers (بديل اختياري)
الكود Portable بالكامل. الفروق الوحيدة: بيئة تشغيل Workers وعدم توفر next/image optimizer المدمج.

## الخطوات
1. `npm i -D @opennextjs/cloudflare wrangler`
2. `open-next.config.ts`:
```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
export default defineCloudflareConfig({});