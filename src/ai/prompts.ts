import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { prompts } from "@/db/schema";
import { redis } from "@/lib/redis";
import { DEFAULT_PROMPTS } from "./prompts.defaults";

// مدة الكاش الموحدة. أي تعديل أدمن يستدعي invalidatePromptCache فوراً.
const CACHE_TTL_SECONDS = 60;
const VAR_RE = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

export type PromptKey = keyof typeof DEFAULT_PROMPTS;

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(VAR_RE, (_, name: string) => {
    const v = vars[name];
    return v === undefined || v === null ? "" : String(v);
  });
}

export async function getPrompt(
  key: PromptKey,
  vars: Record<string, string> = {}
): Promise<string> {
  const cacheKey = `prompt:${key}`;

  let content: string | null = null;
  try {
    content = (await redis.get<string>(cacheKey)) ?? null;
  } catch {
    content = null;
  }

  if (!content) {
    let dbContent: string | null = null;
    try {
      const [row] = await db
        .select({ content: prompts.content })
        .from(prompts)
        .where(eq(prompts.key, key))
        .limit(1);
      dbContent = row?.content ?? null;
    } catch {
      dbContent = null;
    }

    content = dbContent?.trim() || DEFAULT_PROMPTS[key];

    try {
      await redis.set(cacheKey, content, { ex: CACHE_TTL_SECONDS });
    } catch {
      /* redis error ignored — نكمل بالـ content الحالي */
    }
  }

  return interpolate(content, vars);
}

// تُستدعى من الـ admin عند تعديل prompt. تُبطِل الكاش فوراً.
export async function invalidatePromptCache(key?: PromptKey): Promise<void> {
  try {
    if (key) {
      await redis.del(`prompt:${key}`);
    } else {
      await Promise.all(
        (Object.keys(DEFAULT_PROMPTS) as PromptKey[]).map((k) =>
          redis.del(`prompt:${k}`)
        )
      );
    }
  } catch {
    /* تجاهل أخطاء redis — سينتهي الكاش طبيعياً خلال 60 ثانية */
  }
}

// تُستخدم عند كتابة prompt جديد من الأدمن.
export async function savePrompt(
  key: PromptKey,
  content: string,
  updatedBy: string
): Promise<void> {
  const clean = content.trim().slice(0, 20_000);
  await db
    .insert(prompts)
    .values({ key, content: clean, updatedBy })
    .onConflictDoUpdate({
      target: prompts.key,
      set: { content: clean, updatedBy, updatedAt: new Date() },
    });
  await invalidatePromptCache(key);
}