// /start — استمارة طلب المتجر (نموذج الوكالة). ?d=<رابط المسودة> يستكمل مسودة محفوظة، والمسودة المرسلة تفتح
// صفحة متابعتها. لا روابط هنا لتسجيل الدخول أو لوحة البناء الذاتي القديمة.
import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { IntakeForm } from "@/components/intake/IntakeForm";
import { emptyIntake, type IntakeData } from "@/intake/schema";
import { draftIsOpen, findByDraftToken, isMissingTable, openQueueLength, readData, requestAssets } from "@/intake/repo";
import { intakeSettings } from "@/intake/guard";
import { estimateEta, etaText } from "@/intake/eta";
import { agencyWhatsappUrl } from "@/intake/notify";
import { derivedToken } from "@/intake/tokens";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "اطلب متجرك | Colapia",
  description: "استمارة دقيقتين: احكيلنا عن متجرك، وفريق Colapia يصمم ويبني ويراجع متجرك قبل التسليم.",
  robots: { index: false, follow: false },
  // الرابط السري للمسودة (?d=) لا يخرج مع Referer إلى أي موقع يفتحه العميل من الصفحة.
  referrer: "no-referrer",
};

export const viewport: Viewport = { themeColor: "#07091a", colorScheme: "dark" };

export default async function StartPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const d = typeof sp.d === "string" ? sp.d : null;

  let initial: { token: string | null; version: number; data: IntakeData } = { token: null, version: 0, data: emptyIntake() };
  let urls: Record<string, string> = {};
  let eta = etaText(estimateEta(0));
  let closedMessage: string | null = null;
  let followTarget: string | null = null;

  try {
    const settings = await intakeSettings();
    if (!settings.enabled) closedMessage = "بنجهز الفريق لطلبات جديدة. ابعتلنا رسالة وهنرد عليك بأسرع وقت.";
    eta = etaText(estimateEta(await openQueueLength(), settings.capacityPerDay));
    if (d) {
      const row = await findByDraftToken(d);
      if (row && (row.status === "submitted" || row.status === "converted")) followTarget = `/follow/${derivedToken("track", row.id)}`;
      else if (row && draftIsOpen(row)) {
        initial = { token: d, version: row.draftVersion, data: readData(row.data) };
        urls = Object.fromEntries((await requestAssets(row.id)).map((a) => [a.key, a.url]));
      }
    }
  } catch (e) {
    // الكود نُشر قبل تشغيل migration 0006: الاستمارة تظهر وتخبر بالانتظار عند أول حفظ بدل خطأ 500.
    if (!isMissingTable(e)) throw e;
  }
  if (followTarget) redirect(followTarget);

  return (
    <IntakeForm
      initial={initial}
      initialUrls={urls}
      etaText={eta}
      whatsappUrl={agencyWhatsappUrl("أهلاً، عندي سؤال عن طلب متجر من Colapia")}
      closedMessage={closedMessage}
    />
  );
}
