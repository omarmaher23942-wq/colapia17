"use client";

// LaunchKit — «عُدّة الإطلاق»: صورة ستوري (1080×1920) وبوست (1080×1080) بهوية المتجر ومنتج يختاره التاجر ورمز QR
// لرابطه، تُرسم على canvas في المتصفح (تشكيل عربي صحيح) وتُنزَّل PNG؛ ونصوص جاهزة للنسخ (إعلانات، بث واتساب، بايو،
// تعليق) من بيانات المتجر وحقائقه فقط؛ وملصق QR للطباعة.
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download, Printer } from "lucide-react";
import { formatEgp } from "@/lib/money";
import { launchCopy } from "@/lib/launch-copy";

export type KitProduct = { id: string; name: string; pricePiasters: number; compareAtPiasters: number | null; image: string | null };
type Props = {
  storeName: string;
  tagline: string | null;
  url: string;
  host: string;
  logo: string | null;
  colors: { primary: string; onPrimary: string; background: string; foreground: string };
  products: KitProduct[];
  facts: string[];
  codes: { code: string; label: string }[];
};

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, r: number) {
  const s = Math.max(w / img.width, h / img.height);
  const iw = img.width * s;
  const ih = img.height * s;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.clip();
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  ctx.restore();
}

/** يلف النص العربي على عرض محدد ويعيد عدد الأسطر المرسومة. */
function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number, maxLines: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines) shown[maxLines - 1] = `${shown[maxLines - 1]}…`;
  shown.forEach((l, i) => ctx.fillText(l, x, y + i * lineH));
  return shown.length;
}

async function draw(canvas: HTMLCanvasElement, format: "story" | "post", p: Props, product: KitProduct | null, code: Props["codes"][number] | null): Promise<boolean> {
  const W = 1080;
  const H = format === "story" ? 1920 : 1080;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const font = getComputedStyle(document.body).fontFamily || "system-ui";
  await document.fonts.ready;
  ctx.direction = "rtl";
  ctx.textAlign = "center";

  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, p.colors.primary);
  g.addColorStop(1, p.colors.foreground);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const pad = 72;
  let y = format === "story" ? 150 : 90;
  const logo = p.logo ? await loadImage(p.logo) : null;
  if (logo) {
    const lh = 110;
    const lw = Math.min(360, (logo.width / logo.height) * lh);
    ctx.drawImage(logo, (W - lw) / 2, y, lw, lh);
    y += lh + 40;
  }
  ctx.fillStyle = p.colors.onPrimary;
  ctx.font = `800 ${format === "story" ? 78 : 64}px ${font}`;
  wrap(ctx, p.storeName, W / 2, y + 60, W - pad * 2, 86, 2);
  y += format === "story" ? 150 : 120;

  let tainted = false;
  const imgH = format === "story" ? 900 : 470;
  const imgW = format === "story" ? W - pad * 2 : 600;
  const img = product?.image ? await loadImage(product.image) : null;
  if (img) {
    cover(ctx, img, (W - imgW) / 2, y, imgW, imgH, 48);
    y += imgH + 60;
  } else if (p.tagline) {
    ctx.font = `600 52px ${font}`;
    y += 40;
    y += wrap(ctx, p.tagline, W / 2, y, W - pad * 2, 70, 3) * 70 + 40;
  }

  if (product) {
    ctx.font = `700 ${format === "story" ? 58 : 46}px ${font}`;
    y += wrap(ctx, product.name, W / 2, y, W - pad * 2, 70, 2) * 70;
    ctx.font = `900 ${format === "story" ? 76 : 58}px ${font}`;
    ctx.fillText(formatEgp(product.pricePiasters), W / 2, y + 30);
    if (product.compareAtPiasters && product.compareAtPiasters > product.pricePiasters) {
      ctx.globalAlpha = 0.7;
      ctx.font = `500 40px ${font}`;
      const old = formatEgp(product.compareAtPiasters);
      ctx.fillText(old, W / 2, y + 90);
      const w = ctx.measureText(old).width;
      ctx.fillRect(W / 2 - w / 2, y + 76, w, 4);
      ctx.globalAlpha = 1;
      y += 60;
    }
    y += 90;
  }

  if (code) {
    ctx.fillStyle = p.colors.background;
    const bw = 620;
    ctx.beginPath();
    ctx.roundRect((W - bw) / 2, y, bw, 96, 48);
    ctx.fill();
    ctx.fillStyle = p.colors.foreground;
    ctx.font = `800 42px ${font}`;
    ctx.fillText(`${code.label} بالكود ${code.code}`, W / 2, y + 62);
    y += 130;
  }

  const qrSize = format === "story" ? 260 : 190;
  const qr = await loadImage(await QRCode.toDataURL(p.url, { margin: 1, width: qrSize * 2 }));
  const qy = H - qrSize - (format === "story" ? 170 : 80);
  if (qr) {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect((W - qrSize) / 2 - 16, qy - 16, qrSize + 32, qrSize + 32, 28);
    ctx.fill();
    ctx.drawImage(qr, (W - qrSize) / 2, qy, qrSize, qrSize);
  }
  ctx.fillStyle = p.colors.onPrimary;
  ctx.font = `700 40px ${font}`;
  ctx.fillText(p.host, W / 2, qy + qrSize + 70);
  try {
    canvas.toDataURL();
  } catch {
    tainted = true;
  }
  return !tainted;
}

function CopyBlock({ title, text }: { title: string; text: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="rounded-xl border border-edge/10 p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[12.5px] font-black text-ink">{title}</p>
        <button
          type="button"
          onClick={() => void navigator.clipboard.writeText(text).then(() => (setDone(true), setTimeout(() => setDone(false), 1500)))}
          className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-edge/10 px-2.5 text-[12px] font-bold text-ink-2 hover:bg-edge/5"
        >
          {done ? <Check className="size-3.5 text-ok" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
          {done ? "نُسخ" : "نسخ"}
        </button>
      </div>
      <p className="whitespace-pre-line text-[13px] leading-7 text-ink-2">{text}</p>
    </div>
  );
}

export function LaunchKit(p: Props) {
  const [productId, setProductId] = useState(p.products[0]?.id ?? "");
  const [codeKey, setCodeKey] = useState("");
  const story = useRef<HTMLCanvasElement>(null);
  const post = useRef<HTMLCanvasElement>(null);
  const [safe, setSafe] = useState(true);
  const product = p.products.find((x) => x.id === productId) ?? null;
  const code = p.codes.find((c) => c.code === codeKey) ?? null;

  useEffect(() => {
    let alive = true;
    void (async () => {
      const ok = await Promise.all([story.current && draw(story.current, "story", p, product, code), post.current && draw(post.current, "post", p, product, code)]);
      if (alive) setSafe(ok.every((x) => x !== false));
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, codeKey]);

  const copy = useMemo(
    () => launchCopy({ storeName: p.storeName, tagline: p.tagline, url: p.url, facts: p.facts, product: product && { name: product.name, pricePiasters: product.pricePiasters, compareAtPiasters: product.compareAtPiasters }, code }),
    [p.storeName, p.tagline, p.url, p.facts, product, code]
  );

  const download = (c: HTMLCanvasElement | null, name: string) => {
    if (!c) return;
    c.toBlob((b) => {
      if (!b) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = `${name}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, "image/png");
  };

  const SELECT = "mt-1.5 w-full rounded-xl border border-edge/10 bg-edge/[0.03] px-3 py-2.5 text-[15px] text-ink outline-none focus:border-nova";
  return (
    <section className="dash-card space-y-4 p-5">
      <header>
        <h2 className="text-[15px] font-black text-ink">عُدّة الإطلاق</h2>
        <p className="mt-1 text-[12.5px] leading-6 text-ink-2">صور جاهزة للنشر بهوية متجرك ورمز QR لرابطه، ونصوص لإعلانك الأول ولعملائك على واتساب، وملصق للطباعة في محلك أو مع الطلبات.</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-[13px] font-bold text-ink">
          المنتج في الصور والنصوص
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={SELECT}>
            <option value="">بدون منتج (هوية المتجر فقط)</option>
            {p.products.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[13px] font-bold text-ink">
          كود خصم (اختياري)
          <select value={codeKey} onChange={(e) => setCodeKey(e.target.value)} className={SELECT}>
            <option value="">بدون كود</option>
            {p.codes.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} ({c.label})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-[9fr_16fr] items-end gap-3">
        <figure className="space-y-2">
          <canvas ref={story} className="w-full rounded-xl border border-edge/10" aria-label="صورة ستوري" />
          <button type="button" disabled={!safe} onClick={() => download(story.current, "story")} className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-nova text-[12.5px] font-black text-white disabled:opacity-50">
            <Download className="size-4" aria-hidden="true" /> ستوري
          </button>
        </figure>
        <figure className="space-y-2">
          <canvas ref={post} className="w-full rounded-xl border border-edge/10" aria-label="صورة بوست" />
          <button type="button" disabled={!safe} onClick={() => download(post.current, "post")} className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-nova text-[12.5px] font-black text-white disabled:opacity-50">
            <Download className="size-4" aria-hidden="true" /> بوست مربع
          </button>
        </figure>
      </div>
      {!safe ? <p className="text-[12px] text-warn">تعذر تنزيل الصورة لأن صورة المنتج من موقع خارجي. انقل صور منتجاتك لمتجرك من صفحة المنتجات ثم أعد المحاولة.</p> : null}

      <a href="/print/poster" target="_blank" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-edge/10 px-4 text-[13px] font-bold text-ink-2 hover:bg-edge/5">
        <Printer className="size-4" aria-hidden="true" /> ملصق QR للطباعة (A4)
      </a>

      <div className="grid gap-3 md:grid-cols-2">
        {copy.map((c) => (
          <CopyBlock key={c.key} title={c.title} text={c.text} />
        ))}
      </div>
    </section>
  );
}
