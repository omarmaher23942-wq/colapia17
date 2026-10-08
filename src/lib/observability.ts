import "server-only";
import { headers } from "next/headers";
import { db } from "@/db/client";
import { systemEvents } from "@/db/schema";
import { readRequestId } from "./correlation";

export async function captureException(error: unknown, context?: Record<string, unknown>) {
  const reqId = await readRequestId();
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  console.error(`[CRITICAL] reqId: ${reqId} | ${errorMessage}`, errorStack);

  try {
    const serializedError = (() => {
      try {
        return JSON.stringify({
          level: "error",
          category: "system",
          event: "unhandled_exception",
          reqId,
          error: {
            message: errorMessage,
            stack: errorStack?.slice(0, 1000),
          },
          data: context,
        }).slice(0, 500);
      } catch {
        return `[${reqId}] ${errorMessage}`.slice(0, 500);
      }
    })();

    await db.insert(systemEvents).values({
      scope: "system",
      message: serializedError,
    });
  } catch (dbError) {
    console.error("[observability] Failed to persist exception to DB", dbError);
  }

  return reqId;
}

export async function getClientIp(): Promise<string> {
  try {
    const h = await headers();
    return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0.0.0.0";
  } catch {
    return "0.0.0.0";
  }
}