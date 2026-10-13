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

/** السعر الحالي للمتجر التالي والتجديد (قرار 14-أ.2: لا سعر مشطوب ولا عدّاد على الهبوط). */
export interface LandingPricing {
  price: number;
  renewal: number;
}