import Link from "next/link";

/** مسار التنقل (Breadcrumb) لصفحات المتجر. العنصر الأخير هو الصفحة الحالية. */
export function Breadcrumbs({ items }: { items: { name: string; href?: string }[] }) {
  return (
    <nav aria-label="مسار التصفح" className="mb-4 flex flex-wrap items-center gap-1.5 text-[13px] opacity-80">
      {items.map((c, i) => (
        <span key={`${c.name}-${i}`} className="flex items-center gap-1.5">
          {i > 0 ? <span aria-hidden="true">/</span> : null}
          {c.href && i < items.length - 1 ? (
            <Link href={c.href} className="hover:underline focus-visible:outline-none focus-visible:ring-2">
              {c.name}
            </Link>
          ) : (
            <span aria-current="page" className="font-bold">
              {c.name}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
