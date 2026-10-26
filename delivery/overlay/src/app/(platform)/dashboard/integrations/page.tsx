// /dashboard/integrations — حالة الخدمات المربوطة بمشروعك (قاعدة البيانات، الصور، الميزات الذكية، الفيديو، البريد)
// ومفتاح Groq الذي يُدخل من هنا. بقية المفاتيح متغيرات في Cloudflare.
import type { Metadata } from "next";
import { requireStoreArea } from "@/server/merchant-guard";
import { setupStatus } from "@/server/setup/status";
import { getSetting, maskKey } from "@/server/settings";
import { IntegrationsCenter } from "./IntegrationsCenter";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الربط والمفاتيح" };

export default async function IntegrationsPage() {
  await requireStoreArea("settings");
  const [status, saved] = await Promise.all([setupStatus(), getSetting<string>("keys.groq").catch(() => null)]);
  return <IntegrationsCenter checks={status.checks} groqSaved={maskKey(saved)} groqFromEnv={Boolean(process.env.GROQ_API_KEY?.trim())} />;
}
