import { GridSkeleton } from "@/components/storefront/GridSkeleton";

// «كل المنتجات» لا تستدعي notFound، فهيكل التحميل هنا لا يحوّل صفحة غير موجودة إلى 200 (بخلاف صفحتي المنتج والقسم).
export default function Loading() {
  return <GridSkeleton />;
}
