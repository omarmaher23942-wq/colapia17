// مسارات الإرسال والتنظيف والبريد بقاعدة وRedis وUploadThing وResend مُحاكاة: نتحقق من السلوك الذي يهم العميل
// (لا حصة محروقة بخطأ مؤقت، لا ملف يتيم، لا بريد ضائع) لا من تفاصيل الاستعلامات.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const selects: unknown[][] = [];
  const sets: Record<string, unknown>[] = [];
  const state = { deleted: 0, claim: true, mailFirst: "OK" as string | null | "THROW" };
  const chain = (rows: unknown[]) => {
    const c: Record<string, unknown> = {};
    for (const m of ["from", "where", "limit", "orderBy"]) c[m] = () => c;
    c.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(rows).then(res, rej);
    c.catch = (rej: (e: unknown) => unknown) => Promise.resolve(rows).catch(rej);
    return c;
  };
  return {
    selects,
    sets,
    state,
    chain,
    deleteFiles: vi.fn(),
    sendTemplatedEmail: vi.fn(),
    pipelineIncr: vi.fn(),
    mediaApiNull: { v: false },
  };
});

vi.mock("@/db/client", () => ({
  db: {
    select: () => h.chain(h.selects.shift() ?? []),
    delete: () => ({
      where: async () => {
        h.state.deleted += 1;
      },
    }),
    insert: () => ({ values: () => ({ catch: async () => undefined, then: (r: (v: unknown) => unknown) => Promise.resolve().then(r) }) }),
    update: () => ({
      set: (v: Record<string, unknown>) => {
        h.sets.push(v);
        const p = Promise.resolve([{ id: "r1" }]) as Promise<unknown[]> & { returning?: () => Promise<unknown[]> };
        p.returning = async () => (h.state.claim ? [{ id: "r1" }] : []);
        return { where: () => p };
      },
    }),
  },
}));
vi.mock("@/lib/redis", () => ({
  redis: {
    mget: vi.fn(async () => [0, 0, 0, 0]),
    set: vi.fn(async () => {
      if (h.state.mailFirst === "THROW") throw new Error("redis down");
      return h.state.mailFirst;
    }),
    del: vi.fn(async () => 1),
    pipeline: () => ({ set: () => undefined, incr: (k: string) => h.pipelineIncr(k), expire: () => undefined, exec: async () => [] }),
  },
}));
vi.mock("@/ai/lifecycle/notify", () => ({ notifyAdmin: vi.fn(async () => undefined) }));
vi.mock("@/lib/flags", () => ({ getFlag: vi.fn(async () => ({ enabled: true, config: null })) }));
vi.mock("@/lib/email", () => ({ sendTemplatedEmail: (...a: unknown[]) => h.sendTemplatedEmail(...a) }));
vi.mock("@/server/media-host", () => ({
  mediaApi: vi.fn(async () =>
    h.mediaApiNull.v ? null : { remove: async (keys: string[]) => Boolean(((await h.deleteFiles(keys)) as { success?: boolean } | undefined)?.success) }
  ),
}));
vi.mock("@/lib/env", async (orig) => ({
  ...(await orig<typeof import("@/lib/env")>()),
  env: { AUTH_SECRET: "unit-test-secret-unit-test-secret-1234", INTAKE_REPLY_TO: undefined, AGENCY_WHATSAPP: undefined },
  getOwnerAlertEmails: () => ["owner@example.com"],
}));

import { checkIntake, commitIntake } from "@/intake/guard";
import { DEFAULT_INTAKE_LIMITS } from "@/intake/rules";
import { purgeExpiredDrafts } from "@/intake/purge";
import { notifySubmitted } from "@/intake/notify";
import { emptyIntake } from "@/intake/schema";
import type { RequestRow } from "@/intake/repo";

beforeEach(() => {
  h.selects.length = 0;
  h.sets.length = 0;
  h.state.deleted = 0;
  h.state.claim = true;
  h.state.mailFirst = "OK";
  h.mediaApiNull.v = false;
  h.deleteFiles.mockReset();
  h.sendTemplatedEmail.mockReset();
  h.pipelineIncr.mockReset();
});

describe("فحص الإرسال لا يحجز حصة", () => {
  it("checkIntake لا يرفع أي عدّاد، والمفاتيح مجزّأة (لا رقم ولا IP نصاً)", async () => {
    h.selects.push([{ n: 0 }], [{ n: 0 }]);
    const r = await checkIntake({ ip: "41.33.10.2", email: "a@gmail.com", whatsapp: "01012345678", limits: DEFAULT_INTAKE_LIMITS });
    expect(r.decision.ok).toBe(true);
    expect(h.pipelineIncr).not.toHaveBeenCalled(); // الإرسال لم يُحفظ بعد
    expect(r.counters.length).toBe(4);
    for (const [key] of r.counters) {
      expect(key).not.toContain("01012345678");
      expect(key).not.toContain("41.33.10.2");
      expect(key).not.toContain("a@gmail.com");
    }
  });

  it("commitIntake وحده يرفع العدّادات", async () => {
    h.selects.push([{ n: 0 }], [{ n: 0 }]);
    const r = await checkIntake({ ip: "41.33.10.2", email: null, whatsapp: "01012345678", limits: DEFAULT_INTAKE_LIMITS });
    await commitIntake(r.counters);
    expect(h.pipelineIncr).toHaveBeenCalledTimes(r.counters.length);
  });

  it("طلب مفتوح لنفس وسيلة التواصل يُرفض بلا عدّادات", async () => {
    h.selects.push([{ n: 1 }], [{ n: 0 }]);
    const r = await checkIntake({ ip: "41.33.10.2", email: "a@gmail.com", whatsapp: null, limits: DEFAULT_INTAKE_LIMITS });
    expect(r.decision).toMatchObject({ ok: false, reason: "contact" });
    expect(r.counters).toEqual([]);
  });
});

describe("حذف المسودات المنتهية", () => {
  it("لا يُحذف صف قبل تأكيد حذف ملفاته", async () => {
    h.selects.push([{ id: "q1" }], [{ requestId: "q1", key: "k1" }]);
    h.deleteFiles.mockResolvedValue({ success: false, deletedCount: 0 });
    const r = await purgeExpiredDrafts();
    expect(r).toEqual({ requests: 0, files: 0, deferred: 1 });
    expect(h.state.deleted).toBe(0);
  });

  it("تأكيد الحذف (حتى لو سبق حذف المفتاح: deletedCount=0) يسمح بحذف الصف", async () => {
    h.selects.push([{ id: "q1" }], [{ requestId: "q1", key: "k1" }]);
    h.deleteFiles.mockResolvedValue({ success: true, deletedCount: 0 });
    const r = await purgeExpiredDrafts();
    expect(r.requests).toBe(1);
    expect(h.state.deleted).toBe(1);
  });

  it("بلا مفتاح UploadThing: مسودة بملفات تبقى، ومسودة بلا ملفات تُحذف", async () => {
    h.mediaApiNull.v = true;
    h.selects.push([{ id: "q1" }, { id: "q2" }], [{ requestId: "q1", key: "k1" }]);
    const r = await purgeExpiredDrafts();
    expect(r).toMatchObject({ requests: 1, deferred: 1 });
    expect(h.state.deleted).toBe(1);
  });

  it("الملفات تُحذف على دفعات لا تتجاوز 100 مفتاح", async () => {
    const keys = Array.from({ length: 230 }, (_, i) => ({ requestId: "q1", key: `k${i}` }));
    h.selects.push([{ id: "q1" }], keys);
    h.deleteFiles.mockResolvedValue({ success: true, deletedCount: 100 });
    await purgeExpiredDrafts();
    expect(h.deleteFiles.mock.calls.map((c) => (c[0] as string[]).length)).toEqual([100, 100, 30]);
  });
});

describe("بريد الطلب", () => {
  const row = {
    id: "r1",
    code: "REQ-ABCDE",
    storeName: "متجر اختبار <b>x</b>",
    email: "client@example.com",
    whatsapp: "01012345678",
    source: "web",
    utm: null,
    submittedAt: new Date("2026-10-11T10:00:00Z"),
    etaFrom: new Date("2026-10-11T22:00:00Z"),
    etaTo: new Date("2026-10-15T10:00:00Z"),
  } as unknown as RequestRow;
  const data = emptyIntake();

  it("نجاح الإرسال: لا تُعاد أي علامة، وعنوان رسالة العميل بلا اسم المتجر", async () => {
    h.sendTemplatedEmail.mockResolvedValue({ ok: true });
    await notifySubmitted(row, data, []);
    expect(h.sets.some((s) => s.teamNotifiedAt === null || s.clientEmailedAt === null)).toBe(false);
    const clientCall = h.sendTemplatedEmail.mock.calls.map((c) => c[0] as { to: unknown; subject: string }).find((a) => a.to === "client@example.com");
    expect(clientCall?.subject).toBe("استلمنا طلب متجرك (REQ-ABCDE)");
    expect(clientCall?.subject).not.toContain("اختبار");
  });

  it("فشل الإرسال يُعيد دور الفريق والعميل ليُعاد لاحقاً (لا طلب بلا تنبيه)", async () => {
    h.sendTemplatedEmail.mockResolvedValue({ ok: false, error: "domain not verified" });
    await notifySubmitted(row, data, []);
    expect(h.sets.filter((s) => s.teamNotifiedAt === null).length).toBe(1);
    expect(h.sets.filter((s) => s.clientEmailedAt === null).length).toBe(1);
  });

  it("استثناء داخل الإرسال يعامل كفشل أيضاً", async () => {
    h.sendTemplatedEmail.mockRejectedValue(new Error("boom"));
    await notifySubmitted(row, data, []);
    expect(h.sets.some((s) => s.teamNotifiedAt === null)).toBe(true);
    expect(h.sets.some((s) => s.clientEmailedAt === null)).toBe(true);
  });

  it("تعطل Redis: لا نرسل للعميل (نفضّل التأجيل على إغراق صندوق أحد) ونعيد دوره", async () => {
    h.state.mailFirst = "THROW";
    h.sendTemplatedEmail.mockResolvedValue({ ok: true });
    await notifySubmitted(row, data, []);
    const toClient = h.sendTemplatedEmail.mock.calls.some((c) => (c[0] as { to: unknown }).to === "client@example.com");
    expect(toClient).toBe(false);
    expect(h.sets.some((s) => s.clientEmailedAt === null)).toBe(true);
  });

  it("دور محجوز سابقاً (إرسال متزامن آخر): لا إرسال", async () => {
    h.state.claim = false;
    await notifySubmitted(row, data, []);
    expect(h.sendTemplatedEmail).not.toHaveBeenCalled();
  });
});
