import Link from "next/link";
import { CheckCircle2, Circle, CircleDot, ExternalLink } from "lucide-react";
import { PROJECT_STEPS } from "@/agency/status";
import { clientProjects } from "@/server/repos/client-projects";
import { cn } from "@/lib/utils";

const day = (d: Date | null) => (d ? new Intl.DateTimeFormat("ar-EG-u-nu-latn", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Cairo" }).format(d) : "—");

/** «مشروعي»: حالة كل مشروع للعميل، تاريخ التسليم، المستودع، ورابط المتجر (يملؤهما الفريق بعد الميتنج). */
export async function ClientHome({ merchantId }: { merchantId: string }) {
  const projects = await clientProjects(merchantId);
  if (!projects.length) {
    return (
      <section className="dash-card p-6 text-center">
        <h1 className="text-xl font-black">لا مشاريع على هذا الحساب بعد</h1>
        <p className="mt-2 text-[14px] leading-7 text-ink-2">يظهر مشروعكم هنا بعد تأكيد الدفع. إن حجزتم ببريد آخر فادخلوا به، أو راسلونا.</p>
      </section>
    );
  }
  return (
    <div className="space-y-5">
      {projects.map((p) => (
        <section key={p.id} className="dash-card space-y-4 p-5">
          <header>
            <p className="font-mono text-[12px] text-ink-3">{p.code}</p>
            <h1 className="text-xl font-black">{p.storeName}</h1>
            <p className="mt-1 text-[14px] leading-7 text-ink-2">{p.status.detail}</p>
          </header>
          {p.status.step > 0 ? (
            <ol className="space-y-1" aria-label="مراحل المشروع">
              {PROJECT_STEPS.map((label, i) => {
                const n = i + 1;
                const done = n < p.status.step || (n === p.status.step && p.status.key === "delivered");
                const current = n === p.status.step && !done;
                return (
                  <li key={label} aria-current={current ? "step" : undefined} className={cn("flex items-center gap-3 rounded-xl px-2 py-2 text-[14px]", current ? "bg-nova/10 font-black" : done ? "font-bold" : "text-ink-3")}>
                    {done ? <CheckCircle2 className="size-5 text-ok" aria-hidden="true" /> : current ? <CircleDot className="size-5 text-nova" aria-hidden="true" /> : <Circle className="size-5" aria-hidden="true" />}
                    {label}
                  </li>
                );
              })}
            </ol>
          ) : null}
          {p.deliveredAt ? (
            <dl className="grid gap-3 text-[13.5px] sm:grid-cols-2">
              <div><dt className="text-ink-3">تاريخ التسليم</dt><dd className="font-bold">{day(p.deliveredAt)}</dd></div>
              <div>
                <dt className="text-ink-3">المستودع</dt>
                <dd className="font-bold" dir="ltr">{p.repoUrl ? <a href={p.repoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">{p.repoUrl}<ExternalLink className="size-3.5" aria-hidden="true" /></a> : <span className="font-medium text-ink-3">يضيفه الفريق بعد الجلسة</span>}</dd>
              </div>
              <div>
                <dt className="text-ink-3">رابط المتجر</dt>
                <dd className="font-bold" dir="ltr">{p.storeUrl ? <a href={p.storeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">{p.storeUrl}<ExternalLink className="size-3.5" aria-hidden="true" /></a> : <span className="font-medium text-ink-3">يضيفه الفريق بعد النشر</span>}</dd>
              </div>
            </dl>
          ) : null}
          {p.deliveredAt ? (
            <Link href={`/dashboard/edit?project=${p.id}`} className="inline-flex min-h-11 items-center rounded-xl bg-nova px-5 text-[13.5px] font-black text-white">
              طلب تعديل
            </Link>
          ) : null}
        </section>
      ))}
    </div>
  );
}
