// dashboard/transfer — «نقل البيانات» إلى قاعدة العميل (المشاهدة لمن يملك الإعدادات، والبدء لصاحب المتجر وحده).
import { requireStoreArea } from "@/server/merchant-guard";
import { getTransferView } from "@/server/transfer";
import { TransferPanel } from "@/components/dashboard/transfer/TransferPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "نقل البيانات" };

const fmt = new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "long", timeZone: "Africa/Cairo" });

export default async function TransferPage() {
  const access = await requireStoreArea("settings");
  const v = await getTransferView(access.store.id);
  return (
    <div className="mx-auto max-w-2xl">
      <TransferPanel
        init={{
          state: v.state,
          jobId: v.jobId,
          percent: v.percent,
          label: v.label,
          error: v.error,
          hostHint: v.hostHint,
          purgeLabel: v.platformPurgeAt ? `حتى ${fmt.format(v.platformPurgeAt)}` : null,
        }}
      />
    </div>
  );
}
