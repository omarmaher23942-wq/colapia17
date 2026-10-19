"use client";

// PathBanners — لافتات أعلى المحتوى التي تتوقف على الصفحة الحالية: تنبيه الاشتراك (يختفي في صفحة الاشتراك نفسها)
// وملاحظة «عرض فقط» لعضو الفريق. تقرأ المسار من المتصفح (usePathname) لأن تخطيط اللوحة لا يُعاد رسمه عند التنقل بين الصفحات،
// فكان المسار المقروء على الخادم يبقى مسار الصفحة الأولى.
import { usePathname } from "next/navigation";
import { areaForPath, type StorePerms } from "@/lib/store-perms";
import type { HostingState } from "@/lib/hosting";
import { HostingBanner } from "./HostingBanner";
import { LockBanner, TrialBanner } from "./billing/TrialBanner";

export function PathBanners({
  hosting,
  perms,
  trial,
  lock,
}: {
  hosting: HostingState;
  perms: StorePerms | null;
  /** التجربة الجارية: موعد انتهائها (ISO) وهل يوجد إيصال قيد المراجعة. */
  trial?: { endsAt: string; reviewPending: boolean } | null;
  /** قفل اللوحة (مجمّد/متوقف). */
  lock?: "frozen" | "paused" | null;
}) {
  const path = usePathname() ?? "";
  const onBilling = path.startsWith("/dashboard/billing");
  const area = areaForPath(path);
  const viewOnly = Boolean(perms && area && perms[area] === "view");
  return (
    <>
      {lock && !onBilling ? <LockBanner lock={lock} /> : null}
      {!lock && trial && !onBilling ? <TrialBanner endsAt={trial.endsAt} reviewPending={trial.reviewPending} /> : null}
      {!lock && !onBilling && (hosting.phase === "renew_soon" || hosting.phase === "grace") ? <HostingBanner state={hosting} /> : null}
      {viewOnly ? (
        <p role="note" className="mb-4 rounded-xl border border-warn/30 bg-warn/[0.06] px-4 py-2.5 text-[13px] font-bold text-warn">
          صلاحيتكم هنا «عرض فقط». أي تعديل يحتاج صلاحية من صاحب المتجر.
        </p>
      ) : null}
    </>
  );
}
