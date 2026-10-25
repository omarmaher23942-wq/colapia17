import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStore, getBlueprint, getStoreBySubdomain, getBlueprintOrNull } from "@/lib/tenant";
import { Markdown } from "@/components/storefront/Markdown";
import { resolvePolicyPage } from "@/blueprint/policy-pages";
import { groundedText, truthfulBlueprint } from "@/blueprint/facts";
import { getStoreFacts } from "@/server/repos/facts";
import { answersLd, pageMetadata } from "@/lib/storefront-seo";
import { leadSentence, seoLocale } from "@/lib/seo-meta";
import { storeAnswers } from "@/lib/seo-answers";
import { jsonLdString } from "@/lib/json-ld";

// الصفحات القانونية تُكتب من سياسة المتجر نفسها؛ غيرها (عن المتجر، تواصل) نص حر يُفحص عند كل عرض.
const LEGAL = new Set(["shipping", "returns", "privacy", "terms"]);

type Props = { params: Promise<{ store: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { store: sub, slug } = await params;
  const store = await getStoreBySubdomain(sub);
  const bp = store ? await getBlueprintOrNull(store.id) : null;
  const page = bp ? resolvePolicyPage(bp, slug) : null;
  if (!page || !bp) return { robots: { index: false } };
  return pageMetadata({ title: page.title, path: `/pages/${encodeURIComponent(page.slug)}`, description: leadSentence(page.body, 150) }, { name: bp.brand.name, image: bp.seo.ogImage ?? bp.brand.logo?.url, locale: seoLocale(bp) });
}

export default async function PolicyPage({ params }: Props) {
  const { store: sub, slug } = await params;
  const store = await requireStore(sub);
  const raw = await getBlueprint(store.id);
  const facts = await getStoreFacts(store.id, raw);
  const page = resolvePolicyPage(truthfulBlueprint(raw, facts), slug, facts);
  if (!page) notFound();
  const body = LEGAL.has(page.slug)
    ? page.body
    : page.body
        .split("\n")
        .map((line) => {
          if (line.startsWith("#")) return line;
          const bullet = /^\s*[-*]\s+/.exec(line)?.[0] ?? "";
          const text = groundedText(line.slice(bullet.length), facts);
          return text ? `${bullet}${text}` : "";
        })
        .filter((l, i, a) => l || a[i - 1])
        .join("\n");
  // صفحة الأسئلة المولَّدة (لم يكتب التاجر نسخته): FAQPage بنفس الإجابات المعروضة وسمة speakable.
  const generatedFaq = page.slug === "faq" && !raw.pages.find((p) => p.slug === "faq")?.body.trim();
  const ld = generatedFaq ? answersLd(store, raw, { title: page.title, slug: page.slug }, storeAnswers(truthfulBlueprint(raw, facts), facts)) : null;
  return (
    <article className="container-x max-w-3xl py-12" data-speakable={generatedFaq ? "" : undefined}>
      {ld ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(ld) }} /> : null}
      <h1 className="mb-6 text-3xl">{page.title}</h1>
      <Markdown text={body} />
    </article>
  );
}
