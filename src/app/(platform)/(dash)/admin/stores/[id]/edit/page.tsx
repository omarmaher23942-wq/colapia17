import { redirect } from "next/navigation";
import { requirePlatformPage } from "@/server/platform-guard";

export const dynamic = "force-dynamic";

/**
 * صفحة تعديل المتجر من لوحة الأونر.
 * بعد إزالة StudioEditor، التعديل أصبح عبر ContentEditor في صفحة التاجر
 * /dashboard/content. نُعيد التوجيه لصفحة إدارة المتجر مع رابط واضح.
 */
export default async function PlatformEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePlatformPage({ cap: "stores.manage" });
  const { id } = await params;
  if (!id) redirect("/admin/stores");
  redirect(`/admin/stores/${id}`);
}