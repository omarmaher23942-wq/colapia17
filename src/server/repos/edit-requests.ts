// عقد V4: طلبات التعديل بعد التسليم (يملكها الشريحة K1، ويقرؤها مساعد Claude في K7).
export type EditRequestView = {
  id: string;
  storeName: string;
  clientEmail: string;
  title: string;
  details: string;
  repoUrl: string | null;
  status: string;
  free: boolean;
};

export async function getEditRequest(id: string): Promise<EditRequestView | null> {
  void id;
  return null;
}
