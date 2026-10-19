// GridSkeleton — هيكل شبكة منتجات أثناء تحميل القسم أو البحث، بألوان المتجر نفسه (متغيرات CSS من غلاف المتجر)،
// بدل شاشة تحميل عامة تغيّر شكل المتجر لحظة التنقل.
export function GridSkeleton({ title = true }: { title?: boolean }) {
  return (
    <div className="container-x py-8" role="status" aria-label="جارٍ التحميل">
      {title ? <div className="mb-6 h-8 w-48 animate-pulse rounded-lg motion-reduce:animate-none" style={{ background: "color-mix(in oklab, var(--foreground) 8%, transparent)" }} /> : null}
      <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="space-y-2">
            <div className="aspect-[4/5] animate-pulse rounded-[var(--r-card,1rem)] motion-reduce:animate-none" style={{ background: "color-mix(in oklab, var(--foreground) 7%, transparent)" }} />
            <div className="h-4 w-3/4 animate-pulse rounded motion-reduce:animate-none" style={{ background: "color-mix(in oklab, var(--foreground) 7%, transparent)" }} />
            <div className="h-4 w-1/3 animate-pulse rounded motion-reduce:animate-none" style={{ background: "color-mix(in oklab, var(--foreground) 7%, transparent)" }} />
          </div>
        ))}
      </div>
      <span className="sr-only">جارٍ التحميل…</span>
    </div>
  );
}
