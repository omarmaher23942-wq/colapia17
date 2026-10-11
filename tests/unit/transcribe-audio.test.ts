import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: { insert: () => ({ values: async () => undefined }), select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }) } }));
vi.mock("@/lib/redis", () => ({
  redis: new Proxy({}, { get: () => async () => null }),
}));

import { MAX_TRANSCRIBE_BYTES, transcribeAudio } from "@/ai/providers";

const meta = { purpose: "transcribe" } as Parameters<typeof transcribeAudio>[1];
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const audio = (bytes = 3000, headers: Record<string, string> = {}) => new Response(new Uint8Array(bytes), { status: 200, headers });

describe("transcribeAudio", () => {
  it("نجاح: يرسل الملف بالنوع والامتداد الحقيقيين ويعيد النص", async () => {
    fetchMock.mockResolvedValueOnce(audio()).mockResolvedValueOnce(new Response(JSON.stringify({ text: " أهلاً بيك " }), { status: 200 }));
    const r = await transcribeAudio("https://utfs.io/f/a", meta, { mime: "audio/webm;codecs=opus" });
    expect(r).toEqual({ ok: true, text: "أهلاً بيك" });
    const form = fetchMock.mock.calls[1]![1].body as FormData;
    const file = form.get("file") as File;
    expect(file.name).toBe("voice.webm");
    expect(file.type).toBe("audio/webm");
  });

  it("فشل التنزيل ≠ نص فارغ", async () => {
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 404 }));
    expect(await transcribeAudio("https://utfs.io/f/a", meta)).toEqual({ ok: false, error: "download" });
  });

  it("ملف أكبر من الحد يُرفض قبل الإرسال لـ Groq (من الهيدر ومن الحجم الفعلي)", async () => {
    fetchMock.mockResolvedValueOnce(audio(10, { "content-length": String(MAX_TRANSCRIBE_BYTES + 1) }));
    expect(await transcribeAudio("https://utfs.io/f/a", meta)).toEqual({ ok: false, error: "too_large" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(audio(MAX_TRANSCRIBE_BYTES + 5));
    expect(await transcribeAudio("https://utfs.io/f/a", meta)).toEqual({ ok: false, error: "too_large" });
  });

  it("رد Groq فارغ = empty، وخطأ HTTP = provider (فشل لا نجاح)", async () => {
    fetchMock.mockResolvedValueOnce(audio()).mockResolvedValueOnce(new Response(JSON.stringify({ text: "  " }), { status: 200 }));
    expect(await transcribeAudio("https://utfs.io/f/a", meta)).toEqual({ ok: false, error: "empty" });
    fetchMock.mockResolvedValueOnce(audio()).mockResolvedValueOnce(new Response("rate limit", { status: 429 }));
    expect(await transcribeAudio("https://utfs.io/f/a", meta)).toEqual({ ok: false, error: "provider" });
  });
});
