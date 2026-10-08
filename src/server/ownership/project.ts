// project.ts — مشروع متجر تاجر محدد (ملفات جاهزة) من بيانات متجره الحالية.
import "server-only";
import { getBlueprintOrNull } from "@/lib/tenant";
import { defaultBlueprint } from "@/blueprint/defaults";
import { clientEnv } from "@/lib/env";
import { buildStoreProject, STORE_IDENTITY_FILES, type TemplateFile } from "./template";

/**
 * ملفات مشروع المتجر. identity = "keep" لتحديث كود متجر استُلم وحُذفت بياناته من المنصة: يُبنى الكود فقط،
 * وملفات الهوية (الاسم والخطوط والألوان والتصميم) تبقى كما هي في مستودع التاجر.
 */
export async function projectFilesFor(
  store: { id: string; name: string; subdomain: string },
  opts: { identity?: "current" | "keep" } = {}
): Promise<TemplateFile[]> {
  const current = opts.identity === "keep" ? null : await getBlueprintOrNull(store.id);
  if (!current && opts.identity !== "keep") throw new Error("store blueprint not found");
  const blueprint = current ?? defaultBlueprint({ name: store.name } as never);
  const { files, missing } = await buildStoreProject(process.cwd(), {
    storeName: store.name,
    subdomain: store.subdomain,
    blueprint,
    platformOrigin: clientEnv.NEXT_PUBLIC_APP_URL,
  });
  // استيراد لم يُحل يعني مشروعاً لن يُبنى: لا نسلّم للتاجر مشروعاً معطوباً أبداً.
  if (missing.length) throw new Error(`template has unresolved imports: ${missing.slice(0, 5).join(", ")}`);
  if (opts.identity === "keep") {
    const identity = new Set<string>(STORE_IDENTITY_FILES);
    return files.filter((f) => !identity.has(f.path));
  }
  return files;
}
