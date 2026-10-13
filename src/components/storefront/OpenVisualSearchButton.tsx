"use client";
// يفتح «دوّري بالصورة» من أي صفحة (النافذة نفسها في رأس المتجر).
import { Camera } from "lucide-react";
import { OPEN_VISUAL_SEARCH } from "./VisualSearch";

export function OpenVisualSearchButton() {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_VISUAL_SEARCH))} className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold opacity-80 hover:opacity-100">
      <Camera className="size-4" strokeWidth={1.75} aria-hidden="true" /> أو دوّري بالصورة
    </button>
  );
}
