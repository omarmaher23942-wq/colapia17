// /admin/edits/[id] — طلب تعديل واحد بنصه الكامل وملفاته وأزرار حالته.
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { requirePlatformPage } from "@/server/platform-guard";
import { getEditRequest } from "@/server/repos/edit-requests";
import { EditCard } from "@/components/platform/EditInbox";

export const dynamic = "force-dynamic";

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformPage({ cap: "requests.assign" });
  const { id } = await params;
  const e = await getEditRequest(id);
  if (!e) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-4 text-[#eaf0ff]" dir="rtl">
      <Link href="/admin/edits" className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-bold text-[#8fa8ff]">
        <ArrowRight className="size-4" aria-hidden="true" /> طلبات التعديل
      </Link>
      <EditCard full e={{ ...e, createdAt: e.createdAt.toISOString(), doneAt: e.doneAt?.toISOString() ?? null }} />
    </div>
  );
}
