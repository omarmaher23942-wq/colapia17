// sample.ts — هوية عيّنة ثابتة لسكربتات التوليد والاختبارات (لا بيانات حقيقية).
import type { DeliveryIdentity } from "./types";

export const SAMPLE_IDENTITY: DeliveryIdentity = {
  storeName: "متجر التجربة",
  slug: "demo-store",
  ownerEmail: "owner@example.com",
  niche: "fashion",
  instagram: "demo.store",
  whatsapp: "01012345678",
  requestCode: "REQ-SAMPLE",
  generatedAt: "2026-01-01T00:00:00.000Z",
};
