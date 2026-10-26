import "server-only";
// transfer/index.ts — نقطة ربط «نقل البيانات» (الشريحة N4 تستبدل الجسم). زر «نقل البيانات» في قسم تفعيل الموقع يستدعي
// startTransfer بمعرّف المتجر ورابط قاعدة العميل؛ الخادم وحده يعرف الاثنين.
export type TransferResult = { ok: true } | { ok: false; error: string };

export async function startTransfer(storeId: string, databaseUrl: string): Promise<TransferResult> {
  void storeId;
  void databaseUrl;
  return { ok: false, error: "not_ready" };
}
