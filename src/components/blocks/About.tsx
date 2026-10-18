import Image from "next/image";
import { Quote } from "lucide-react";
import { SectionShell } from "@/components/storefront/SectionShell";
import { Markdown } from "@/components/storefront/Markdown";

type Sec = {
  title?: string;
  body?: string;
  [key: string]: unknown;
};

export function About({ s }: { s: Sec }) {
  const body = typeof s.body === "string" ? s.body : "";
  const image = s.image && typeof (s.image as { url?: unknown }).url === "string" ? (s.image as { url: string; alt?: string }) : null;

  if (!body || body.trim().length < 15) return null;

  return (
    <SectionShell s={s as any}>
      <div
        className={image ? "mx-auto grid max-w-5xl overflow-hidden rounded-3xl border shadow-xs md:grid-cols-2" : "max-w-3xl mx-auto rounded-3xl border p-8 sm:p-12 shadow-xs space-y-4"}
        style={{
          background: "var(--card)",
          borderColor: "var(--border)",
          color: "var(--card-foreground)",
        }}
        dir="rtl"
      >
        {image ? (
          <div className="relative aspect-[4/3] md:aspect-auto md:min-h-80">
            <Image src={image.url} alt={image.alt || ""} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
          </div>
        ) : null}
        <div className={image ? "space-y-4 p-8 sm:p-10" : "space-y-4"}>
        <div className="size-12 rounded-2xl bg-primary/10 text-primary grid place-items-center">
          <Quote className="size-6" />
        </div>
        <h2 className="text-xl sm:text-2xl font-black font-heading">
          {typeof s.title === "string" && s.title.trim() ? s.title : "عن متجرنا"}
        </h2>
        <div className="text-xs sm:text-sm leading-relaxed opacity-85">
          <Markdown text={body} />
        </div>
        </div>
      </div>
    </SectionShell>
  );
}