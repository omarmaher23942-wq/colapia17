import "server-only";
// platform-guard.ts — صلاحيات فريق الوكالة في صفحات وإجراءات لوحة المالك. ليس "use server" (لا يصير نقطة استدعاء).
// الأدوار والصلاحيات في src/agency/roles.ts (مصدر واحد للخادم والواجهة). كل صفحة وكل إجراء يتحقق بنفسه.
import { redirect } from "next/navigation";
import { getPlatformSession } from "@/server/auth";
import { can, type Capability } from "@/agency/roles";

export type PlatformUser = NonNullable<Awaited<ReturnType<typeof getPlatformSession>>>;

/**
 * العضو الحالي إن كان يملك الصلاحية المطلوبة. `write: true` = إدارة المنصة (المالك والمدير)، وهي ما كانت تعنيه
 * قبل أدوار المرحلة 3، فالإجراءات القديمة تبقى للمالك والمدير وحدهما.
 */
export async function platformUser(opts: { write?: boolean; cap?: Capability } = {}): Promise<PlatformUser | null> {
  const u = await getPlatformSession();
  if (!u) return null;
  if (opts.write && !can(u.role, "stores.manage")) return null;
  if (opts.cap && !can(u.role, opts.cap)) return null;
  return u;
}

/** للإجراءات التي ترمي خطأً عند الرفض (Server Actions القديمة بـ throw). */
export async function requirePlatformCap(cap: Capability, message = "غير مصرح لهذا الدور."): Promise<PlatformUser> {
  const u = await getPlatformSession();
  if (!u || !can(u.role, cap)) throw new Error(message);
  return u;
}

/**
 * حارس صفحات لوحة المالك. **يجب استدعاؤه في أول كل page.tsx تحت admin/**: التخطيط (layout) وحده لا يحمي
 * الصفحة، لأن طلب RSC مصنوعاً (هيدر Next-Router-State-Tree يوهم أن التخطيط رُسم) يعرض الصفحة دون تشغيل التخطيط.
 * tests/unit/admin-guard.test.ts يفشل إن غابت هذه الدالة عن أي صفحة. عضو بلا صلاحية الصفحة يعود للوحة الرئيسية.
 */
export async function requirePlatformPage(opts: { write?: boolean; cap?: Capability } = {}): Promise<PlatformUser> {
  const u = await getPlatformSession();
  if (!u) redirect("/admin/login");
  if ((opts.write && !can(u.role, "stores.manage")) || (opts.cap && !can(u.role, opts.cap))) redirect("/admin?denied=1");
  return u;
}
