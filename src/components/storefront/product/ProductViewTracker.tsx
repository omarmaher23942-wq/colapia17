"use client";

// يرسل حدث مشاهدة المنتج مرة واحدة لكل زيارة صفحة (بعيداً عن «شاهدتم مؤخراً» كي لا يتكرر الحدث بتغير الواجهة).
import { useEffect } from "react";

export function ProductViewTracker({ productId, name, price }: { productId: string; name: string; price: number }) {
  useEffect(() => {
    window.clpTrack?.("product_view", { productId, name, price });
  }, [productId, name, price]);
  return null;
}
