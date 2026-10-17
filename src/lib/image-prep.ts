// image-prep.ts — تجهيز صور المنتجات في المتصفح قبل الرفع (الميزة 136): تصحيح اتجاه الصورة، قصّ الهوامش الفارغة،
// وتوسيط المنتج على خلفية فاتحة موحدة. يعمل على canvas في المتصفح (لا اعتماد على مكتبة خادم)، وإن تعذر أي جزء تُرفع
// الصورة المضغوطة كما هي. المنطق الحسابي (حدود المنتج داخل الصورة) خالص ومختبَر.

export type Box = { x: number; y: number; w: number; h: number };

/**
 * صندوق المحتوى: أصغر مستطيل يضم كل بكسل يختلف عن لون الخلفية (يُقدَّر من زوايا الصورة) بأكثر من threshold.
 * data = RGBA كما في ImageData. يعيد null إن لم يُعثر على خلفية موحّدة (صورة بيئة كاملة: لا قص).
 */
export function contentBox(data: ArrayLike<number>, w: number, h: number, threshold = 28): Box | null {
  if (w < 8 || h < 8) return null;
  const px = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!] as const;
  };
  const corners = [px(1, 1), px(w - 2, 1), px(1, h - 2), px(w - 2, h - 2)];
  const bg = [0, 1, 2].map((c) => Math.round(corners.reduce((n, p) => n + p[c]!, 0) / 4));
  // الزوايا يجب أن تتفق (خلفية موحدة) وإلا فالصورة ليست منتجاً على خلفية.
  const agree = corners.every((p) => Math.abs(p[0] - bg[0]!) + Math.abs(p[1] - bg[1]!) + Math.abs(p[2] - bg[2]!) < 60);
  if (!agree) return null;
  const differs = (x: number, y: number) => {
    const p = px(x, y);
    if (p[3] < 16) return false;
    return Math.abs(p[0] - bg[0]!) + Math.abs(p[1] - bg[1]!) + Math.abs(p[2] - bg[2]!) > threshold;
  };
  let minX = w, minY = h, maxX = -1, maxY = -1;
  // أخذ عينات كل 2 بكسل يكفي لتقدير الحدود بسرعة.
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      if (differs(x, y)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 2, h: maxY - minY + 2 };
}

/** يوسّع الصندوق بهامش نسبي ويقيّده بحدود الصورة. */
export function padBox(b: Box, w: number, h: number, pad = 0.08): Box {
  const px = Math.round(Math.max(b.w, b.h) * pad);
  const x = Math.max(0, b.x - px);
  const y = Math.max(0, b.y - px);
  return { x, y, w: Math.min(w - x, b.w + px * 2), h: Math.min(h - y, b.h + px * 2) };
}

/** هل القص يستحق؟ (يوفر 12% على الأقل من المساحة ولا يبتلع المنتج). */
export function worthCropping(b: Box, w: number, h: number): boolean {
  const ratio = (b.w * b.h) / (w * h);
  return ratio < 0.88 && ratio > 0.06;
}

/** أبعاد اللوحة النهائية: مربعة تقريباً بحد أقصى `size`، تحفظ نسبة المنتج داخلها. */
export function fitInto(box: Pick<Box, "w" | "h">, size = 1200): { w: number; h: number; scale: number } {
  const scale = Math.min(size / box.w, size / box.h, 1.5);
  return { w: Math.round(box.w * scale), h: Math.round(box.h * scale), scale };
}

export const CLEAN_BG = "#f6f5f2";

/** يقصّ ويوسّط على خلفية فاتحة، ويصحح الاتجاه من بيانات الصورة. يعيد الملف الأصلي عند أي تعذر. */
export async function cleanupImage(file: File): Promise<File> {
  try {
    if (typeof createImageBitmap !== "function" || typeof document === "undefined") return file;
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    const work = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const w = Math.max(8, Math.round(bmp.width * work));
    const h = Math.max(8, Math.round(bmp.height * work));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const found = contentBox(ctx.getImageData(0, 0, w, h).data, w, h);
    const crop = found && worthCropping(found, w, h) ? padBox(found, w, h) : { x: 0, y: 0, w, h };
    const out = fitInto(crop);
    const canvasSize = Math.max(out.w, out.h);
    const o = document.createElement("canvas");
    o.width = canvasSize;
    o.height = canvasSize;
    const octx = o.getContext("2d");
    if (!octx) return file;
    octx.fillStyle = CLEAN_BG;
    octx.fillRect(0, 0, canvasSize, canvasSize);
    octx.drawImage(c, crop.x, crop.y, crop.w, crop.h, Math.round((canvasSize - out.w) / 2), Math.round((canvasSize - out.h) / 2), out.w, out.h);
    const blob = await new Promise<Blob | null>((res) => o.toBlob(res, "image/jpeg", 0.9));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}
