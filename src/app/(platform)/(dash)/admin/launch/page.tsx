// /admin/launch — مركز جاهزية الإطلاق: كل ما تعتمد عليه المنصة بفحص حي، ولكل مشكلة سببها الحقيقي وخطوة إصلاحها.
// وأزرار لاختبار البحث بالصورة نموذجاً نموذجاً وإرسال بريد تجربة، وآخر أخطاء الذكاء الاصطناعي بنصها من المزوّد.
import { Rocket } from "lucide-react";
import { requirePlatformPage } from "@/server/platform-guard";
import { hostingName, recentAiFailures, runLaunchChecks } from "@/server/launch-checks";
import { LaunchBoard } from "@/components/platform/LaunchBoard";

export const dynamic = "force-dynamic";
export const metadata = { title: "جاهزية الإطلاق" };

const HOSTING: Record<ReturnType<typeof hostingName>, string> = { cloudflare: "Cloudflare Workers", vercel: "Vercel", node: "خادم Node" };

export default async function LaunchPage() {
  await requirePlatformPage({ cap: "settings" });
  const [groups, failures] = await Promise.all([runLaunchChecks(), recentAiFailures()]);
  const all = groups.flatMap((g) => g.checks);
  const counts = { fail: all.filter((c) => c.status === "fail").length, warn: all.filter((c) => c.status === "warn").length };
  return (
    <div className="mx-auto max-w-4xl space-y-6 text-[#eaf0ff]" dir="rtl">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <Rocket className="size-6 text-[#8fa8ff]" aria-hidden="true" /> جاهزية الإطلاق
        </h1>
        <p className="mt-1 text-[13px] text-[#8d97c4]">
          فحص حي الآن لكل خدمة ومفتاح. يعمل التطبيق على {HOSTING[hostingName()]}.{" "}
          {counts.fail ? <b className="text-rose-300">{counts.fail} مشكلة تمنع جزءاً من المنصة</b> : <b className="text-emerald-300">لا مشاكل تمنع العمل</b>}
          {counts.warn ? <span> · {counts.warn} تنبيه</span> : null}
        </p>
      </header>
      <LaunchBoard
        groups={groups}
        failures={failures.map((f) => ({ ...f, at: f.at.toLocaleString("ar-EG-u-nu-latn", { timeZone: "Africa/Cairo", dateStyle: "short", timeStyle: "short" }) }))}
      />
    </div>
  );
}
