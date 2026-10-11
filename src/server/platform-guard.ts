import "server-only";
// platform-guard.ts — صلاحية فريق الوكالة في إجراءات لوحة المالك. ليس "use server" (لا يصير نقطة استدعاء).
// القراءة لأي عضو نشط، والكتابة للمالك والمدير فقط (المراجع يقرأ حتى تأتي أدوار المرحلة 3).
import { getPlatformSession } from "@/server/auth";

export type PlatformUser = NonNullable<Awaited<ReturnType<typeof getPlatformSession>>>;

export async function platformUser(opts: { write?: boolean } = {}): Promise<PlatformUser | null> {
  const u = await getPlatformSession();
  if (!u) return null;
  if (opts.write && u.role === "reviewer") return null;
  return u;
}
