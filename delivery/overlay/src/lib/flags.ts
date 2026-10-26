import "server-only";
// flags.ts (مشروعك الخاص) — لا لوحة مفاتيح تشغيل مركزية: كل الميزات مفعّلة بإعداداتها الافتراضية.
export async function getFlag<T = Record<string, unknown>>(_key: string): Promise<{ enabled: boolean; config: T | null }> {
  return { enabled: true, config: null };
}

export const isOn = async (_key: string) => true;
