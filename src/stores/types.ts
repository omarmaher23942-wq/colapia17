// types.ts — شكل سجل المتاجر المولَّد (registry.generated.ts). لا يستورده كود المتاجر.
import type { ReactNode } from "react";
import type { BlockProps, HomeProps, PageMeta, PageProps, SectionProps, SectionType, SlotProps } from "@/stores-kit/types";

type Comp<P> = (props: P) => ReactNode | Promise<ReactNode>;
type Loader<P, Extra = object> = () => Promise<{ default: Comp<P> } & Extra>;

export type StoreMeta = { slug: string; name: string };

export type StoreEntry = {
  meta: StoreMeta;
  /** stores/<slug>/theme.css كما هو (يُحقن بعد تصميم النواة، على صفحات هذا المتجر وحده). */
  theme: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sections: Partial<Record<SectionType, Loader<SectionProps<any>>>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blocks: Record<string, Loader<BlockProps<any>>>;
  slots: { Header?: Loader<SlotProps>; Footer?: Loader<SlotProps>; Home?: Loader<HomeProps> };
  pages: Record<string, Loader<PageProps, { meta?: PageMeta }>>;
  /** stores/<slug>/blueprint.json وseed.json إن وُجدا: يزرعهما «جهّز المتجر» في القاعدة بدل المسودة الآلية (agency/provision.ts). */
  blueprint?: () => Promise<{ default: unknown }>;
  seed?: () => Promise<{ default: unknown }>;
};
