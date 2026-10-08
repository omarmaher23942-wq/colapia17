import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { onboardingSessions } from "@/db/schema";
import { findSessionByToken } from "./sessions";

export type OpenResult =
  | { state: "ok"; sessionId: string; draft: Record<string, unknown>; draftVersion: number; lastStep: string | null; expiresAt: string }
  | { state: "submitted"; submittedAt: string | null }
  | { state: "expired" | "revoked" | "invalid" };

const SEEN_THROTTLE_MS = 60_000;

export async function openOnboarding(token: string): Promise<OpenResult> {
  const s = await findSessionByToken(token);
  if (!s) return { state: "invalid" };
  if (s.status === "submitted") return { state: "submitted", submittedAt: s.submittedAt?.toISOString() ?? null };
  if (s.status === "expired" || s.status === "revoked") return { state: s.status };

  const now = new Date();
  if (!s.openedAt || !s.lastSeenAt || now.getTime() - s.lastSeenAt.getTime() > SEEN_THROTTLE_MS) {
    await db
      .update(onboardingSessions)
      .set({ openedAt: s.openedAt ?? now, lastSeenAt: now })
      .where(eq(onboardingSessions.id, s.id))
      .catch(() => {});
  }
  return {
    state: "ok",
    sessionId: s.id,
    draft: s.draft,
    draftVersion: s.draftVersion,
    lastStep: s.lastStep,
    expiresAt: s.expiresAt.toISOString(),
  };
}