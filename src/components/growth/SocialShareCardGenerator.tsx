"use client";

import { useState, useRef, useEffect } from "react";
import {
  Image as ImageIcon,
  Download,
  Loader2,
  LayoutTemplate,
} from "lucide-react";
import { toast } from "sonner";
import { generateSocialCardAction } from "@/server/actions/marketing-campaigns";
import { formatEgp } from "@/lib/money";
import { cn } from "@/lib/utils";

const SW = 1.75;

export function SocialShareCardGenerator({ productId }: { productId: string }) {
  const [template, setTemplate] = useState<"story" | "post">("story");
  const [loading, setLoading] = useState(false);
  const [cardData, setCardData] = useState<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fetchCardData = async () => {
    setLoading(true);
    const res = await generateSocialCardAction(productId);
    if (res.ok && res.data) {
      setCardData(res.data);
      drawCanvas(res.data, template);
    } else {
      toast.error(res.error);
    }
    setLoading(false);
  };

  const drawCanvas = (data: any, type: "story" | "post") => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = type === "story" ? 1080 : 1080;
    const height = type === "story" ? 1920 : 1080;
    canvas.width = width;
    canvas.height = height;

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#07091a");
    gradient.addColorStop(1, "#1a2150");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = data.imageUrl;
    img.onload = () => {
      const imgSize = type === "story" ? 800 : 600;
      const imgX = (width - imgSize) / 2;
      const imgY = type === "story" ? 300 : 150;

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(imgX, imgY, imgSize, imgSize, 40);
      ctx.clip();
      ctx.drawImage(img, imgX, imgY, imgSize, imgSize);
      ctx.restore();

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.direction = "rtl";

      ctx.font = "bold 40px Cairo, sans-serif";
      ctx.fillStyle = "#8fa8ff";
      ctx.fillText(data.storeName, width / 2, type === "story" ? 150 : 80);

      ctx.font = "900 70px Cairo, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(data.productName, width / 2, imgY + imgSize + 120);

      ctx.font = "bold 60px monospace";
      ctx.fillStyle = "#34d399";
      ctx.fillText(formatEgp(data.price * 100), width / 2, imgY + imgSize + 220);

      if (data.compareAt) {
        ctx.font = "40px monospace";
        ctx.fillStyle = "#94a3b8";
        const textWidth = ctx.measureText(
          formatEgp(data.compareAt * 100)
        ).width;
        const x = width / 2;
        const y = imgY + imgSize + 300;
        ctx.fillText(formatEgp(data.compareAt * 100), x, y);
        ctx.beginPath();
        ctx.moveTo(x - textWidth / 2, y - 12);
        ctx.lineTo(x + textWidth / 2, y - 12);
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 4;
        ctx.stroke();
      }

      ctx.fillStyle = "#6f86ff";
      ctx.beginPath();
      ctx.roundRect(width / 2 - 200, height - 200, 400, 80, 40);
      ctx.fill();
      ctx.fillStyle = "#07091a";
      ctx.font = "bold 36px Cairo, sans-serif";
      ctx.fillText("تسوق الآن", width / 2, height - 145);
    };
  };

  useEffect(() => {
    if (cardData) drawCanvas(cardData, template);
  }, [template, cardData]);

  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${cardData?.productName || "product"}-${template}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast.success("تم تحميل الصورة بنجاح");
  };

  return (
    <div
      className="rounded-3xl border border-edge/10 bg-space-2 p-6 shadow-2xl"
      dir="rtl"
    >
      <header className="mb-6 flex items-center justify-between border-b border-edge/10 pb-4">
        <div className="flex items-center gap-2">
          <ImageIcon className="size-5 text-nova-2" strokeWidth={SW} />
          <h2 className="text-base font-black text-ink">
            مولد كروت السوشيال ميديا
          </h2>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <p className="text-xs text-ink-3 leading-relaxed">
            قم بتوليد صورة تسويقية احترافية لمنتجك بضغطة زر، جاهزة للنشر على
            إنستاجرام وفيسبوك لجذب المزيد من المبيعات.
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => setTemplate("story")}
              className={cn(
                "flex-1 rounded-xl border py-3 text-xs font-bold transition-colors flex flex-col items-center gap-2",
                template === "story"
                  ? "border-nova-2 bg-nova/15 text-white"
                  : "border-edge/10 bg-edge/[0.02] text-ink-3 hover:bg-edge/5"
              )}
            >
              <LayoutTemplate className="size-5" /> ستوري (9:16)
            </button>
            <button
              onClick={() => setTemplate("post")}
              className={cn(
                "flex-1 rounded-xl border py-3 text-xs font-bold transition-colors flex flex-col items-center gap-2",
                template === "post"
                  ? "border-nova-2 bg-nova/15 text-white"
                  : "border-edge/10 bg-edge/[0.02] text-ink-3 hover:bg-edge/5"
              )}
            >
              <LayoutTemplate className="size-5 rotate-90" /> بوست (1:1)
            </button>
          </div>

          <button
            onClick={fetchCardData}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-nova to-nova-2 py-3 text-sm font-black text-space shadow-md hover:brightness-110 transition-all disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ImageIcon className="size-4" />
            )}
            توليد الصورة
          </button>

          {cardData && (
            <button
              onClick={downloadImage}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-edge/10 bg-edge/5 py-3 text-sm font-bold text-ink hover:bg-edge/10 transition-colors"
            >
              <Download className="size-4" /> تحميل الصورة
            </button>
          )}
        </div>

        <div className="flex items-center justify-center rounded-2xl border border-dashed border-edge/10 bg-black/40 p-4 min-h-[400px]">
          <canvas
            ref={canvasRef}
            className={cn(
              "max-w-full rounded-xl shadow-2xl border border-edge/5",
              template === "story"
                ? "h-[400px] w-auto"
                : "w-full h-auto aspect-square"
            )}
            style={{ display: cardData ? "block" : "none" }}
          />
          {!cardData && !loading && (
            <div className="text-center text-ink-3">
              <ImageIcon className="mx-auto size-8 opacity-40 mb-2" />
              <p className="text-xs font-bold">اضغط توليد لعرض المعاينة</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}