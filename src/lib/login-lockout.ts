// login-lockout.ts — قفل مؤقت بعد محاولات دخول فاشلة متتالية على البريد نفسه (خالص: المخزن يُمرَّر، فيُختبر بلا Redis).
export const MAX_FAILS = 5;
export const LOCK_SECONDS = 15 * 60;

export type CounterStore = {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  get(key: string): Promise<number | string | null | undefined>;
  del(key: string): Promise<unknown>;
};

export function createLockout(store: CounterStore, prefix: string) {
  const key = (id: string) => `${prefix}:${id}`;
  return {
    async isLocked(id: string): Promise<boolean> {
      return Number((await store.get(key(id))) ?? 0) >= MAX_FAILS;
    },
    /** يسجّل محاولة فاشلة. عند بلوغ الحد يمتد القفل لكامل المدة من هذه اللحظة. */
    async fail(id: string): Promise<{ locked: boolean; remaining: number }> {
      const n = await store.incr(key(id));
      if (n === 1 || n === MAX_FAILS) await store.expire(key(id), LOCK_SECONDS);
      return { locked: n >= MAX_FAILS, remaining: Math.max(0, MAX_FAILS - n) };
    },
    async clear(id: string): Promise<void> {
      await store.del(key(id));
    },
  };
}
