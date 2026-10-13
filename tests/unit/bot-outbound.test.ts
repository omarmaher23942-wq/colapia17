// سجل رسائل الوكيل الصادرة: يميّز صدى ردّ الوكيل (يُتجاهل) عن رسالة موظف كتبها بنفسه (تُحفظ).
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, unknown>();
let failing = false;

vi.mock("@/lib/redis", () => ({
  redis: {
    set: vi.fn(async (k: string, v: unknown) => {
      if (failing) throw new Error("redis down");
      store.set(k, v);
      return "OK";
    }),
    get: vi.fn(async (k: string) => {
      if (failing) throw new Error("redis down");
      return store.get(k) ?? null;
    }),
  },
}));

import { markOutbound, wasSentByBot } from "@/lib/bot-outbound";

beforeEach(() => {
  store.clear();
  failing = false;
});

describe("سجل رسائل الوكيل الصادرة", () => {
  it("رسالة سجّلها الوكيل = من الوكيل", async () => {
    await markOutbound("m_1");
    expect(await wasSentByBot("m_1", 0)).toBe(true);
  });
  it("رسالة لم تُسجَّل (كتبها موظف) = ليست من الوكيل", async () => {
    await markOutbound("m_1");
    expect(await wasSentByBot("m_2", 0)).toBe(false);
  });
  it("معرّف فارغ لا يُسجَّل ولا يُعدّ من الوكيل", async () => {
    await markOutbound(null);
    await markOutbound(undefined);
    expect(store.size).toBe(0);
    expect(await wasSentByBot(null, 0)).toBe(false);
  });
  it("الصدى الذي يسبق تسجيل المعرّف ينتظر قليلاً ثم يجده", async () => {
    setTimeout(() => void markOutbound("m_late"), 120);
    expect(await wasSentByBot("m_late", 1500)).toBe(true);
  });
  it("عطل Redis لا يُسقط الاستدعاء: تُحفظ الرسالة كما هي ولا تضيع رسالة موظف", async () => {
    failing = true;
    await expect(markOutbound("m_1")).resolves.toBeUndefined();
    expect(await wasSentByBot("m_1", 0)).toBe(false);
  });
});
