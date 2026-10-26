// /dashboard/edit — طلب تعديل بعد التسليم (بوابة العميل). مجاني واحد داخل النافذة، وإلا بالرسوم المعلنة هنا فقط.
import { EditRequestForm, type EditFormProject } from "@/components/client/EditRequestForm";
import { requireClientPortal } from "@/server/client-guard";
import { clientProjects } from "@/server/repos/client-projects";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata = { title: "طلب تعديل" };

export default async function EditPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const session = await requireClientPortal();
  const sp = await searchParams;
  const delivered = (await clientProjects(session.merchantId)).filter((p) => p.deliveredAt && p.edit.ok);
  if (!delivered.length) {
    return (
      <section className="dash-card p-6 text-center">
        <h1 className="text-xl font-black">طلب التعديل يُفتح بعد التسليم</h1>
        <p className="mt-2 text-[14px] leading-7 text-ink-2">متى سُلِّم مشروعكم تطلبون تعديلاتكم من هنا.</p>
      </section>
    );
  }
  const date = new Intl.DateTimeFormat("ar-EG-u-nu-latn", { day: "numeric", month: "long", timeZone: "Africa/Cairo" });
  const projects: EditFormProject[] = delivered.map((p) => {
    const e = p.edit;
    if (!e.ok) throw new Error("unreachable");
    return e.free ? { id: p.id, name: p.storeName, free: true, fee: 0, untilText: date.format(e.until), reason: null } : { id: p.id, name: p.storeName, free: false, fee: e.fee, untilText: null, reason: e.reason };
  });
  return <EditRequestForm projects={projects} selected={projects.find((p) => p.id === sp.project)?.id ?? projects[0]!.id} pay={{ vodafone: env.VODAFONE_CASH_NUMBER, instapay: env.INSTAPAY_NUMBER }} />;
}
