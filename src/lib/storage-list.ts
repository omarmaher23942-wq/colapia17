// storage-list.ts — قراءة رد ListObjectsV2 (واجهة S3) لحساب مساحة المتجر الفعلية وعدد فيديوهاته (منطق خالص مختبَر).

export type ListPage = { bytes: number; files: number; videos: number; videoBytes: number; truncated: boolean; next: string | null };

const VIDEO_RE = /\.(mp4|webm|mov|m4v)$/i;

const unescapeXml = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

/** skip: مفاتيح لا تُحسب على المتجر (مثل إيصالات الدفع للمنصة). */
export function parseListObjects(xml: string, skip?: (key: string) => boolean): ListPage {
  let bytes = 0;
  let files = 0;
  let videos = 0;
  let videoBytes = 0;
  const re = /<Contents>([\s\S]*?)<\/Contents>/g;
  for (let m = re.exec(xml); m; m = re.exec(xml)) {
    const body = m[1] ?? "";
    const key = unescapeXml(/<Key>([\s\S]*?)<\/Key>/.exec(body)?.[1] ?? "");
    const size = Number(/<Size>(\d+)<\/Size>/.exec(body)?.[1] ?? 0) || 0;
    if (!key || (skip && skip(key))) continue;
    files += 1;
    bytes += size;
    if (VIDEO_RE.test(key)) {
      videos += 1;
      videoBytes += size;
    }
  }
  const truncated = /<IsTruncated>true<\/IsTruncated>/i.test(xml);
  const next = truncated ? unescapeXml(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml)?.[1] ?? "") || null : null;
  return { bytes, files, videos, videoBytes, truncated, next };
}
