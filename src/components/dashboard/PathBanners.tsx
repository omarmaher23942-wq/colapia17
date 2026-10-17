"use client";

// PathBanners — لافتات أعلى المحتوى التي تتوقف على الصفحة الحالية: تنبيه الاشتراك (يختفي في صفحة الاشتراك نفسها)
// وملاحظة «عرض فقط» لعضو الفريق. تقرأ المسار من المتصفح (usePathname) لأن تخطيط اللوحة لا يُعاد رسمه عند التنقل بين الصفحات،
// فكان المسار المقروء على الخادم يبقى مسار الصفحة الأولى.
import { usePathname } from "next/navigation";
import { areaForPath, type StorePerms } from "@/lib/store-perms";
import type { HostingState } from "@/lib/hosting";
import { HostingBanner } from "./HostingBanner";

export function PathBanners({ hosting, perms }: { hosting: HostingState; perms: StorePerms | null }) {
  const path = usePathname() ?? "";
  const onBilling = path.startsWith("/dashboard/billing");
  const area = areaForPath(path);
  const viewOnly = Boolean(perms && area && perms[area] === "view");
  return (
    <>
      {!onBilling && (hosting.phase === "renew_soon" || hosting.phase === "grace" || hosting.phase === "paused") ? <HostingBanner state={hosting} /> : null}
      {viewOnly ? (
        <p role="note" className="mb-4 rounded-xl border border-warn/30 bg-warn/[0.06] px-4 py-2.5 text-[13px] font-bold text-warn">
          صلاحيتكم هنا «عرض فقط». أي تعديل يحتاج صلاحية من صاحب المتجر.
        </p>
      ) : null}
    </>
  );
}
