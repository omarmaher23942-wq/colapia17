// resolve.ts — ما يخص متجراً بعينه من سجل المتاجر المولَّد. المفتاح = النطاق الفرعي للمتجر (= اسم مجلده في stores/).
// متجر بلا مجلد يُعرض بالنواة كما هي.
import { STORE_REGISTRY } from "./registry.generated";
import type { StoreEntry } from "./types";
import type { SectionType } from "@/stores-kit/types";

const REGISTRY: Record<string, StoreEntry> = STORE_REGISTRY;

export function storeEntry(subdomain: string): StoreEntry | null {
  return Object.hasOwn(REGISTRY, subdomain) ? REGISTRY[subdomain]! : null;
}

export const storeTheme = (subdomain: string) => storeEntry(subdomain)?.theme ?? "";

export async function loadSectionOverride(subdomain: string, type: SectionType) {
  const load = storeEntry(subdomain)?.sections[type];
  return load ? (await load()).default : null;
}

export async function loadBlock(subdomain: string, name: string) {
  const blocks = storeEntry(subdomain)?.blocks;
  const load = blocks && Object.hasOwn(blocks, name) ? blocks[name] : undefined;
  return load ? (await load()).default : null;
}

export async function loadSlot<K extends keyof StoreEntry["slots"]>(subdomain: string, slot: K) {
  const load = storeEntry(subdomain)?.slots[slot];
  return load ? ((await load()).default as Awaited<ReturnType<NonNullable<StoreEntry["slots"][K]>>>["default"]) : null;
}

/** هل في مجلد المتجر المنشور blueprint.json أو seed.json (بناه الفريق قبل التجهيز)؟ */
export function hasFolderData(subdomain: string): boolean {
  const e = storeEntry(subdomain);
  return Boolean(e?.blueprint || e?.seed);
}

/** blueprint.json وseed.json كما نُشرا في مجلد المتجر (null لما لا يوجد). يفحصهما المستدعي بمخططيهما. */
export async function storeFolderData(subdomain: string): Promise<{ blueprint: unknown; seed: unknown }> {
  const e = storeEntry(subdomain);
  const [bp, seed] = await Promise.all([e?.blueprint?.(), e?.seed?.()]);
  return { blueprint: bp?.default ?? null, seed: seed?.default ?? null };
}

/** صفحة خاصة بمسارها (a أو a/b)، بأحرف صغيرة كما في أسماء الملفات. */
export async function loadPage(subdomain: string, path: string) {
  const pages = storeEntry(subdomain)?.pages;
  const key = path.toLowerCase();
  const load = pages && Object.hasOwn(pages, key) ? pages[key] : undefined;
  if (!load) return null;
  const mod = await load();
  return { Page: mod.default, meta: mod.meta ?? null };
}
