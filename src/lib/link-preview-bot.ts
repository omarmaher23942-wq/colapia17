// link-preview-bot.ts — هل الطلب من زاحف معاينة روابط أو محرك بحث؟ فتح هذه الروابط لا يبدأ عدّاد المعاينة المجانية للتاجر
// (إنستجرام وواتساب وماسنجر يجلبون الرابط تلقائياً عند إرساله في المحادثة). خالص ومختبَر.
const BOT =
  /bot|crawl|spider|preview|facebookexternalhit|facebot|meta-externalagent|meta-externalfetcher|whatsapp|instagram|telegram|slack|discord|skype|linkedin|twitter|pinterest|embedly|headless|lighthouse|curl|wget|python-requests|go-http-client|okhttp/i;

export const isLinkPreviewBot = (userAgent: string | null | undefined): boolean => !userAgent || BOT.test(userAgent);
