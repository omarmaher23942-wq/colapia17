// عقد V4: مولّد مشروع التسليم (يملكه الشريحة K2). يعيد ملفات المشروع المستقل للعميل.
export type ProjectFiles = Record<string, string | Uint8Array>;

/** ملفات مشروع المتجر المستقل لطلب معين (الهوية من بيانات الطلب). */
export async function projectFilesForRequest(requestId: string): Promise<ProjectFiles> {
  void requestId;
  return {};
}
