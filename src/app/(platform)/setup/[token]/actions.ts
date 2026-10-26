"use server";
// actions.ts — رابط الإعداد: (1) أول فتح بشري يبدأ عدّاد المعاينة المجانية مرة واحدة، (2) وضع كلمة المرور لأول مرة ثم الدخول إلى الإعداد.
// البريد وهوية المتجر تُقرأ من الرمز الموقّع على الخادم ولا يمران عبر نموذج المتصفح.
import { headers } from "next/headers";
import { resolveSetupToken } from "@/agent/setup-access";
import { setFirstPasswordAndSignIn } from "@/server/auth";
import { beginPreviewClock } from "@/server/preview-clock";
import { clientIp, limits } from "@/lib/ratelimit";
import { passwordIssues } from "@/lib/password-rules";
import { isLinkPreviewBot } from "@/lib/link-preview-bot";

type Open = { ok: true; endsAt: string | null; started: boolean } | { ok: false };
type Done = { ok: true; redirect: string } | { ok: false; error: string };

/** تُستدعى من المتصفح عند فتح الصفحة فعلاً (لا من زاحف معاينة). آمنة التكرار: العدّاد يبدأ مرة واحدة. */
export async function openSetupLinkAction(token: string): Promise<Open> {
  const h = await headers();
  if (isLinkPreviewBot(h.get("user-agent"))) return { ok: false };
  const r = await resolveSetupToken(token);
  if (!r.ok || r.target.status !== "setup") return { ok: false };
  const clock = await beginPreviewClock(r.target.storeId);
  return { ok: true, endsAt: clock.endsAt?.toISOString() ?? null, started: clock.started };
}

export async function completeSetupAction(token: string, password: string): Promise<Done> {
  const ip = clientIp(await headers());
  if (!(await limits.login.limit(`setup-pw-ip:${ip}`)).success) return { ok: false, error: "محاولات كثيرة. انتظروا دقائق ثم أعيدوا المحاولة." };
  const r = await resolveSetupToken(token);
  if (!r.ok) return { ok: false, error: r.reason === "expired" ? "انتهت صلاحية الرابط. اطلبوا رابطاً جديداً من الفريق." : "الرابط غير صالح." };
  const t = r.target;
  if (t.hasPassword) return { ok: false, error: "سبق وضع كلمة المرور. ادخلوا من صفحة الدخول." };
  if (t.status !== "setup") return { ok: false, error: "هذا المتجر أكمل إعداده؛ ادخلوا من صفحة الدخول." };
  const issues = passwordIssues(String(password ?? ""), { email: t.email });
  if (issues.length) return { ok: false, error: `كلمة المرور يجب أن ${issues[0]}` };
  await beginPreviewClock(t.storeId);
  const ok = await setFirstPasswordAndSignIn(t.merchantId, password, t.storeId);
  if (!ok) return { ok: false, error: "سبق وضع كلمة المرور. ادخلوا من صفحة الدخول." };
  return { ok: true, redirect: "/onboarding" };
}
