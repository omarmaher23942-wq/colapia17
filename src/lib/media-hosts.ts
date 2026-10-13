// media-hosts.ts — هل الصورة مستضافة على مساحة الرفع (R2 أو UploadThing)؟ الصور من أي مضيف آخر تحجبها سياسة أمان المحتوى
// في المتجر واللوحة، فتُنقل إلى مساحة المتجر قبل أن تظهر (مثل صور ملف الاستيراد).
import { isMediaHost } from "./media";

export function isHostedImage(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol === "data:" || u.protocol === "blob:") return true;
    return u.protocol === "https:" && isMediaHost(u.hostname);
  } catch {
    return url.startsWith("/");
  }
}
