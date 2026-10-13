// upload-hosts.ts — أي رابط صورة/إيصال يأتي من المتصفح يجب أن يشير إلى مساحة ملفاتنا (R2 أو UploadThing)، فلا
// تُخزَّن روابط خارجية عشوائية.
import { isMediaHost } from "./media";

export function isTrustedUploadUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && isMediaHost(u.hostname);
  } catch {
    return false;
  }
}
