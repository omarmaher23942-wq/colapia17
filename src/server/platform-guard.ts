import "server-only";
// platform-guard.ts — صلاحية فريق الوكالة في إجراءات لوحة المالك. ليس "use server" (لا يصير نقطة استدعاء).
// القراءة لأي عضو نشط، والكتابة للمالك والمدير فقط (المراجع يقرأ حتى تأتي أدوار المرحلة 3).
import { redirect } from "next/navigation";
import { getPlatformSession } from "@/server/auth";

export type PlatformUser = NonNullable<Awaited<ReturnType<typeof getPlatformSession>>>;

export async function platformUser(opts: { write?: boolean } = {}): Promise<PlatformUser | null> {
  const u = await getPlatformSession();
  if (!u) return null;
  if (opts.write && u.role === "reviewer") return null;
  return u;
}

/**
 * حارس صفحات لوحة المالك. **يجب استدعاؤه في أول كل page.tsx تحت admin/**: التخطيط (layout) وحده لا يحمي
 * الصفحة، لأن طلب RSC مصنوعاً (هيدر Next-Router-State-Tree يوهم أن التخطيط رُسم) يعرض الصفحة دون تشغيل التخطيط.
 * tests/unit/admin-guard.test.ts يفشل إن غابت هذه الدالة عن أي صفحة.
 */
export async function requirePlatformPage(opts: { write?: boolean } = {}): Promise<PlatformUser> {
  const u = await platformUser(opts);
  if (!u) redirect("/admin/login");
  return u;
}
