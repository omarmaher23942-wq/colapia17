// أنواع مشتركة بين Server Component (page.tsx) ومكونات صفحة الهبوط.
export type SessionState = "guest" | "merchant";

export interface LandingReview {
  id: string;
  storeName: string;
  authorName: string;
  authorRole: string | null;
  avatarUrl: string | null;
  rating: number;
  content: string;
}

export interface LandingPricing {
  price: number;
  basePrice: number;
  renewal: number;
  /** باقٍ بهذا السعر (عدّاد حقيقي من المدفوعات المؤكدة؛ null = بلا حد). */
  remaining?: number | null;
  nextPrice?: number | null;
}