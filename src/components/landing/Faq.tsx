// الأسئلة الشائعة: عناصر <details> أصلية (تعمل بلا JavaScript، ونصها في الصفحة لمحركات البحث والإجابة).
import { ChevronDown } from "lucide-react";
import { FAQ } from "@/lib/landing-content";

export function Faq() {
  return (
    <div className="mx-auto mt-12 max-w-3xl space-y-3">
      {FAQ.map((f) => (
        <details key={f.q} className="land-card group rounded-2xl px-5 py-4 open:bg-white/5">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-lg text-[15px] font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff]">
            <h3 className="text-[15px] font-black">{f.q}</h3>
            <ChevronDown className="size-4 shrink-0 text-[#8d97c4] transition group-open:rotate-180" aria-hidden="true" />
          </summary>
          <p className="mt-3 text-[14px] leading-8 text-[#c3cdf0]/80">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
