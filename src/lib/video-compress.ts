// video-compress.ts — مواصفات ضغط فيديو الواجهة في المتصفح (خالص ومختبَر). التنفيذ الفعلي في components/onboarding/video-compress-client.ts.
export const HERO_VIDEO = { maxSeconds: 20, maxWidth: 1280, fps: 24, targetBytes: 6 << 20 } as const;

export type VideoSpec = { width: number; height: number; seconds: number; bitrate: number; fps: number };

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/** أبعاد ومعدل بت مناسبان لحجم مستهدف (ينقص المعدل مع طول المدة). */
export function planCompression(src: { width: number; height: number; duration: number }): VideoSpec {
  const scale = Math.min(1, HERO_VIDEO.maxWidth / Math.max(1, src.width));
  const seconds = Math.max(1, Math.min(src.duration || HERO_VIDEO.maxSeconds, HERO_VIDEO.maxSeconds));
  const byBudget = Math.floor((HERO_VIDEO.targetBytes * 8) / seconds);
  return { width: even(src.width * scale), height: even(src.height * scale), seconds, bitrate: Math.min(2_500_000, Math.max(700_000, byBudget)), fps: HERO_VIDEO.fps };
}

/** أول صيغة تسجيل يدعمها المتصفح، مع تفضيل MP4. */
export function pickRecorderMime(supported: (mime: string) => boolean): { mime: string; ext: "mp4" | "webm" } | null {
  const list: [string, "mp4" | "webm"][] = [
    ["video/mp4;codecs=avc1.42E01E", "mp4"],
    ["video/mp4", "mp4"],
    ["video/webm;codecs=vp9", "webm"],
    ["video/webm;codecs=vp8", "webm"],
    ["video/webm", "webm"],
  ];
  for (const [mime, ext] of list) if (supported(mime)) return { mime, ext };
  return null;
}

/** هل يستحق الضغط؟ (كبير الحجم أو أبعاده أو مدته فوق الحد). */
export function needsCompression(f: { bytes: number; width: number; duration: number }): boolean {
  return f.bytes > HERO_VIDEO.targetBytes || f.width > HERO_VIDEO.maxWidth || f.duration > HERO_VIDEO.maxSeconds;
}
