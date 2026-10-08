// dashboard/design — تصميم المتجر: ما صممه الذكاء الاصطناعي لمتجرك، وإعادة التصميم بضغطة، واستعادة أي تصميم سابق.
import { redirect } from "next/navigation";
import { and, desc, eq, like } from "drizzle-orm";
import { getMerchantSession } from "@/server/auth";
import { db } from "@/db/client";
import { storeBlueprints, storeSnapshots } from "@/db/schema";
import { blueprintSchema } from "@/blueprint/schema";
import { getRedesignState } from "@/server/redesign";
import { storeUrl } from "@/lib/utils";
import { NO_STORE_HREF } from "@/lib/edition";
import { DesignStudio } from "@/components/dashboard/design/DesignStudio";

export const dynamic = "force-dynamic";
export const metadata = { title: "تصميم المتجر" };

const FONT_NAMES: Record<string, string> = {
  cairo: "Cairo",
  tajawal: "Tajawal",
  ibm_plex_arabic: "IBM Plex Arabic",
  almarai: "Almarai",
  changa: "Changa",
  el_messiri: "El Messiri",
  readex_pro: "Readex Pro",
  noto_kufi: "Noto Kufi",
};

export default async function DesignPage() {
  const session = await getMerchantSession();
  if (!session) redirect("/login?redirect=/dashboard/design");
  if (!session.store) redirect(NO_STORE_HREF);
  const store = session.store;

  const [[row], previous, state] = await Promise.all([
    db.select().from(storeBlueprints).where(eq(storeBlueprints.storeId, store.id)).limit(1),
    db
      .select({ id: storeSnapshots.id, version: storeSnapshots.version, createdAt: storeSnapshots.createdAt, data: storeSnapshots.data })
      .from(storeSnapshots)
      .where(and(eq(storeSnapshots.storeId, store.id), like(storeSnapshots.label, "قبل إعادة التصميم%")))
      .orderBy(desc(storeSnapshots.version))
      .limit(6),
    getRedesignState(store.id),
  ]);

  const parsed = row ? blueprintSchema.safeParse(row.data) : null;
  const bp = parsed?.success ? parsed.data : null;
  const summarize = (data: unknown) => {
    const p = blueprintSchema.safeParse(data);
    if (!p.success) return null;
    const t = p.data.theme;
    return {
      concept: p.data.design.concept || "التصميم الأول",
      colors: [t.palette.primary, t.palette.accent, t.palette.background, t.palette.foreground],
      fonts: `${FONT_NAMES[t.fonts.heading] ?? t.fonts.heading} / ${FONT_NAMES[t.fonts.body] ?? t.fonts.body}`,
    };
  };

  return (
    <DesignStudio
      storeUrl={`${storeUrl(store.subdomain)}/?preview=owner`}
      current={
        bp
          ? {
              concept: bp.design.concept,
              mood: bp.design.mood,
              colors: [bp.theme.palette.primary, bp.theme.palette.accent, bp.theme.palette.background, bp.theme.palette.foreground],
              fonts: `${FONT_NAMES[bp.theme.fonts.heading] ?? bp.theme.fonts.heading} / ${FONT_NAMES[bp.theme.fonts.body] ?? bp.theme.fonts.body}`,
              card: bp.theme.productCardStyle,
              hero: bp.home.find((s) => s.type === "hero")?.variant ?? null,
              motion: bp.design.motion,
            }
          : null
      }
      previous={previous
        .map((p) => ({ id: p.id, version: p.version, at: p.createdAt.toISOString(), summary: summarize(p.data) }))
        .filter((p): p is { id: string; version: number; at: string; summary: NonNullable<ReturnType<typeof summarize>> } => Boolean(p.summary))}
      initialState={state}
    />
  );
}
