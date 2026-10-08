"use client";
import { useState } from "react";
import { VariantMatrix, type Variant } from "@/components/dashboard/VariantMatrix";

export function VariantsLab() {
  const [names, setNames] = useState<string[]>(["اللون", "المقاس"]);
  const [variants, setVariants] = useState<Variant[]>(
    ["أسود", "كحلي", "بيج"].flatMap((c) => ["S", "M", "L", "XL"].map((s) => ({ optionValues: [c, s], stock: 5, price: null, isAvailable: true })))
  );
  return (
    <div dir="rtl" className="dash dash-cosmos dark min-h-dvh p-4 text-ink md:p-8">
      <div className="dash-card mx-auto max-w-3xl p-5">
        <VariantMatrix optionNames={names} variants={variants} basePrice={650} onChange={(n, v) => (setNames(n), setVariants(v))} />
      </div>
    </div>
  );
}
