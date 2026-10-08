import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { featureFlags } from "@/db/schema";
import { cached, redis } from "@/lib/redis";

export async function getFlag<T = Record<string, unknown>>(
  key: string
): Promise<{ enabled: boolean; config: T | null }> {
  return cached(`flag:${key}`, 30, async () => {
    const [r] = await db
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.key, key))
      .limit(1);
    return { enabled: r?.enabled ?? true, config: (r?.config as T) ?? null };
  });
}

export const isOn = async (key: string) => (await getFlag(key)).enabled;

export async function setFlag(
  key: string,
  enabled: boolean,
  config?: Record<string, unknown> | null,
  description?: string
) {
  await db
    .insert(featureFlags)
    .values({ key, enabled, config: config ?? null, description })
    .onConflictDoUpdate({
      target: featureFlags.key,
      set: {
        enabled,
        ...(config !== undefined ? { config } : {}),
        updatedAt: new Date(),
      },
    });
  await redis.del(`flag:${key}`);
}