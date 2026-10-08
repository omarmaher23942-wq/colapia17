"use server";

// Platform flags actions — تُفرض صلاحية owner/admin فقط.
// Role = "reviewer" لا يستطيع تعديل أي flag.
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { setFlag } from "@/lib/flags";
import { getPlatformSession } from "@/server/auth";

const keyField = z.string().min(1).max(80).regex(/^[a-z0-9._-]+$/i);
const configField = z.string().max(20_000).optional();

async function requireOwner() {
  const user = await getPlatformSession();
  if (!user) throw new Error("غير مصرح");
  if (user.role === "reviewer") {
    throw new Error("هذه العملية مخصصة لمالك المنصة أو الأدمن فقط");
  }
  return user;
}

export async function setFlagAction(
  rawKey: string,
  enabled: boolean,
  configJson?: string
) {
  await requireOwner();

  const parsedKey = keyField.safeParse(rawKey);
  if (!parsedKey.success) {
    throw new Error("مفتاح غير صالح");
  }

  const parsedConfig = configField.safeParse(configJson);
  if (!parsedConfig.success) {
    throw new Error("حجم الإعدادات كبير جداً");
  }

  let cfg: Record<string, unknown> | null = null;
  if (parsedConfig.data && parsedConfig.data.trim()) {
    try {
      cfg = JSON.parse(parsedConfig.data) as Record<string, unknown>;
      if (cfg === null || typeof cfg !== "object" || Array.isArray(cfg)) {
        throw new Error("يجب أن يكون الكائن JSON");
      }
    } catch (e) {
      throw new Error(
        `تنسيق JSON غير صالح: ${e instanceof Error ? e.message.slice(0, 80) : ""}`
      );
    }
  }

  await setFlag(parsedKey.data, enabled, cfg);

  revalidatePath("/admin/flags");
  revalidatePath("/admin");
  return { ok: true as const };
}

export async function bulkSetFlagsAction(
  updates: { key: string; enabled: boolean; config?: string }[]
) {
  await requireOwner();
  if (!Array.isArray(updates) || updates.length === 0) {
    throw new Error("لا توجد تحديثات");
  }
  if (updates.length > 50) {
    throw new Error("الحد الأقصى 50 مفتاح في الطلب");
  }

  const results: { key: string; ok: boolean; error?: string }[] = [];
  for (const u of updates) {
    try {
      await setFlagAction(u.key, u.enabled, u.config);
      results.push({ key: u.key, ok: true });
    } catch (e) {
      results.push({
        key: u.key,
        ok: false,
        error: e instanceof Error ? e.message : "فشل",
      });
    }
  }

  revalidatePath("/admin/flags");
  revalidatePath("/admin");
  return { ok: true as const, results };
}