"use client";
// bg-removal.ts — إزالة خلفية صور المنتجات داخل متصفح التاجر (اختيارية تماماً، بلا أي تكلفة على الخادم).
// النموذج BiRefNet-lite (رخصة MIT تسمح بالاستخدام التجاري) يعمل عبر transformers.js داخل Web Worker منفصل فلا تتجمد
// الصفحة: WebGPU إن توفر وإلا WebAssembly. لا يُحمَّل أي شيء حتى يطلبه التاجر أول مرة، والمكتبة تأتي من CDN بإصدار
// مثبَّت (لا تدخل حزمة الموقع ولا حزمة الخادم). الملف الأصلي لا يُرفع إن اختار التاجر النسخة المعالجة.

export type BgMode = "transparent" | "white";
export type BgProgress = { phase: "loading"; loaded: number; total: number } | { phase: "ready"; device: "webgpu" | "wasm" };
type Pending = { resolve: (b: Blob) => void; reject: (e: Error) => void };

const LIB = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2/dist/transformers.min.js";
const MODEL = "onnx-community/BiRefNet_lite-ONNX";

// كود العامل نصاً (يُشغَّل من blob:) حتى لا يمر بأداة البناء: يستورد المكتبة من CDN عند أول طلب فقط.
const WORKER_SRC = `
let T = null, model = null, processor = null, device = "wasm", loading = null;
async function load() {
  if (model) return;
  if (!loading) loading = (async () => {
    T = await import(${JSON.stringify(LIB)});
    T.env.allowLocalModels = false;
    try {
      const a = self.navigator && self.navigator.gpu ? await self.navigator.gpu.requestAdapter() : null;
      device = a ? "webgpu" : "wasm";
    } catch (_) { device = "wasm"; }
    const files = {};
    const progress_callback = (p) => {
      if (p && p.status === "progress" && p.file) {
        files[p.file] = { loaded: p.loaded || 0, total: p.total || 0 };
        let loaded = 0, total = 0;
        for (const k in files) { loaded += files[k].loaded; total += files[k].total; }
        self.postMessage({ type: "progress", loaded, total });
      }
    };
    const opts = { device, dtype: device === "webgpu" ? "fp16" : "fp32", progress_callback };
    try {
      [model, processor] = await Promise.all([T.AutoModel.from_pretrained(${JSON.stringify(MODEL)}, opts), T.AutoProcessor.from_pretrained(${JSON.stringify(MODEL)})]);
    } catch (e) {
      if (device !== "webgpu") throw e;
      device = "wasm";
      [model, processor] = await Promise.all([T.AutoModel.from_pretrained(${JSON.stringify(MODEL)}, { ...opts, device: "wasm", dtype: "fp32" }), T.AutoProcessor.from_pretrained(${JSON.stringify(MODEL)})]);
    }
    self.postMessage({ type: "ready", device });
  })();
  try { await loading; } catch (e) { loading = null; throw e; }
}
self.onmessage = async (e) => {
  const { id, blob, mode } = e.data;
  try {
    await load();
    const image = await T.RawImage.fromBlob(blob);
    const { pixel_values } = await processor(image);
    const { output_image } = await model({ input_image: pixel_values });
    const mask = await T.RawImage.fromTensor(output_image[0].sigmoid().mul(255).to("uint8")).resize(image.width, image.height);
    const bmp = await createImageBitmap(blob);
    const w = image.width, h = image.height;
    const c = new OffscreenCanvas(w, h);
    const ctx = c.getContext("2d");
    ctx.drawImage(bmp, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h);
    const m = mask.data, ch = mask.channels || 1;
    for (let i = 0; i < w * h; i++) px.data[i * 4 + 3] = m[i * ch];
    ctx.putImageData(px, 0, 0);
    let out;
    if (mode === "white") {
      const c2 = new OffscreenCanvas(w, h);
      const x2 = c2.getContext("2d");
      x2.fillStyle = "#ffffff";
      x2.fillRect(0, 0, w, h);
      x2.drawImage(c, 0, 0);
      out = await c2.convertToBlob({ type: "image/jpeg", quality: 0.92 });
    } else {
      out = await c.convertToBlob({ type: "image/png" });
    }
    self.postMessage({ type: "done", id, blob: out });
  } catch (err) {
    self.postMessage({ type: "error", id, error: String((err && err.message) || err) });
  }
};
`;

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, Pending>();
const listeners = new Set<(p: BgProgress) => void>();
let readyDevice: "webgpu" | "wasm" | null = null;

/** هل يدعم المتصفح ما يلزم (عامل وحدات + OffscreenCanvas)؟ المتصفحات القديمة تُخبَر بصدق بدل الفشل الصامت. */
export function bgRemovalSupported(): boolean {
  return typeof window !== "undefined" && typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined" && typeof createImageBitmap !== "undefined";
}

export const bgRemovalReady = () => readyDevice !== null;

/** يتابع تقدم تجهيز الأداة (أول مرة فقط: تنزيل النموذج مرة ثم يبقى في ذاكرة المتصفح). */
export function onBgProgress(fn: (p: BgProgress) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function ensureWorker(): Worker {
  if (worker) return worker;
  const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" }));
  worker = new Worker(url, { type: "module" });
  worker.onmessage = (e: MessageEvent) => {
    const d = e.data as { type: string; id?: number; blob?: Blob; error?: string; loaded?: number; total?: number; device?: "webgpu" | "wasm" };
    if (d.type === "progress") listeners.forEach((l) => l({ phase: "loading", loaded: d.loaded ?? 0, total: d.total ?? 0 }));
    else if (d.type === "ready") {
      readyDevice = d.device ?? "wasm";
      listeners.forEach((l) => l({ phase: "ready", device: readyDevice! }));
    } else if (d.id !== undefined) {
      const p = pending.get(d.id);
      if (!p) return;
      pending.delete(d.id);
      if (d.type === "done" && d.blob) p.resolve(d.blob);
      else p.reject(new Error(d.error ?? "bg"));
    }
  };
  worker.onerror = () => {
    for (const [, p] of pending) p.reject(new Error("worker"));
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

/** يزيل خلفية صورة واحدة ويعيد ملفاً جديداً (PNG شفاف أو JPEG على أبيض). يرمي عند التعذر، فيبقي المتصل الأصل. */
export async function removeBackground(file: File, mode: BgMode): Promise<File> {
  if (!bgRemovalSupported()) throw new Error("unsupported");
  const w = ensureWorker();
  const id = ++seq;
  // مهلة: تنزيل النموذج أول مرة قد يطول (5 دقائق)، وبعده دقيقة للصورة الواحدة. بلا مهلة كانت دفعة كاملة تعلق عند صورة واحدة.
  const limit = readyDevice ? 60_000 : 300_000;
  const blob = await new Promise<Blob>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("timeout"));
    }, limit);
    pending.set(id, {
      resolve: (b) => {
        clearTimeout(timer);
        resolve(b);
      },
      reject: (e) => {
        clearTimeout(timer);
        reject(e);
      },
    });
    w.postMessage({ id, blob: file, mode });
  });
  const base = file.name.replace(/\.\w+$/, "") || "product";
  return mode === "white" ? new File([blob], `${base}-white.jpg`, { type: "image/jpeg" }) : new File([blob], `${base}-cutout.png`, { type: "image/png" });
}
