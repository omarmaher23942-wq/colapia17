// صفحات المتجر الخاصة: stores/<slug>/pages/<name>.tsx تُعرض على /<name> داخل هيدر المتجر وفوتره.
// صفحات النواة (/p و/c و/cart…) لها الأولوية دائماً، وأي مسار ليس له ملف = 404 كما كان.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStore, getBlueprint, getStoreBySubdomain } from "@/lib/tenant";
import { getStoreFacts } from "@/server/repos/facts";
import { truthfulBlueprint } from "@/blueprint/facts";
import { createStoreKit } from "@/stores-kit/server";
import { loadPage } from "@/stores/resolve";

type Params = Promise<{ store: string; path: string[] }>;

const pathOf = (segments: string[]) => segments.map((s) => decodeURIComponent(s)).join("/");

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { store: sub, path } = await params;
  const [store, page] = await Promise.all([getStoreBySubdomain(sub), loadPage(sub, pathOf(path))]);
  if (!store || !page?.meta) return {};
  return { title: page.meta.title, description: page.meta.description };
}

export default async function StoreCustomPage({ params, searchParams }: { params: Params; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { store: sub, path } = await params;
  const page = await loadPage(sub, pathOf(path));
  if (!page) notFound();

  const store = await requireStore(sub);
  const bp = await getBlueprint(store.id);
  const facts = await getStoreFacts(store.id, bp);
  const kit = createStoreKit({ store, bp: truthfulBlueprint(bp, facts), facts });
  const { Page } = page;
  return <Page kit={kit} path={path.map((s) => decodeURIComponent(s))} searchParams={await searchParams} />;
}
