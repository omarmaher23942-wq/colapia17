import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { checkAllStores, checkStoreFile } from "../../scripts/stores/guard";
import { generate } from "../../scripts/stores/registry";
import { hasFolderData, loadBlock, loadPage, loadSectionOverride, loadSlot, storeEntry, storeFolderData, storeTheme } from "@/stores/resolve";
import { STORE_REGISTRY } from "@/stores/registry.generated";
import { blueprintSchema } from "@/blueprint/schema";
import { storeSeedSchema } from "@/stores/seed";
import { importSpecs } from "@/server/ownership/template";

const msgs = (file: string, code: string) => checkStoreFile(file, code).map((v) => v.message);

describe("حارس عزل المتاجر الخاصة", () => {
  it("كل مجلدات stores/ الحالية نظيفة", () => {
    expect(checkAllStores()).toEqual([]);
  });

  it("يرفض الوصول للقاعدة والخادم والأسرار من كود متجر", () => {
    const bad = [
      'import { db } from "@/db/client";',
      'import { getTenantDb } from "@/db/tenant";',
      'import { products } from "@/db/schema";',
      'import { requireStore } from "@/lib/tenant";',
      'import { createStoreKit } from "@/stores-kit/server";',
      'import { neon } from "@neondatabase/serverless";',
      'import { eq } from "drizzle-orm";',
      'import fs from "node:fs";',
      'const m = await import("@/server/repos/catalog");',
      'export { db } from "@/db/client";',
    ];
    for (const code of bad) expect(msgs("stores/a/blocks/x.tsx", code), code).not.toEqual([]);
  });

  it("يرفض قراءة ملفات متجر آخر أو الخروج من المجلد", () => {
    expect(msgs("stores/a/blocks/x.tsx", 'import Y from "../../b/blocks/y";')).not.toEqual([]);
    expect(msgs("stores/a/pages/x.tsx", 'import { db } from "../../../src/db/client";')).not.toEqual([]);
    expect(msgs("stores/a/blocks/x.tsx", 'import { helper } from "../lib/helper";')).toEqual([]);
  });

  it("يرفض الأنماط الخطرة", () => {
    expect(msgs("stores/a/blocks/x.tsx", "const k = process.env.DATABASE_URL;")).not.toEqual([]);
    expect(msgs("stores/a/blocks/x.tsx", 'const fs = require("fs");')).not.toEqual([]);
    expect(msgs("stores/a/components/save.ts", '"use server";\nexport async function save() {}')).not.toEqual([]);
    expect(msgs("stores/a/blocks/x.tsx", "<div dangerouslySetInnerHTML={{ __html: s }} />")).not.toEqual([]);
    expect(msgs("stores/a/blocks/x.tsx", 'eval("1")')).not.toEqual([]);
    expect(msgs("stores/a/run.sh", "")).not.toEqual([]);
  });

  it("مكوّن تفاعلي مسموح في components/ وممنوع مباشرة في blocks/", () => {
    const client = '"use client";\nimport { useState } from "react";\nexport function X() { return null; }';
    expect(msgs("stores/a/components/X.tsx", client)).toEqual([]);
    expect(msgs("stores/a/blocks/x.tsx", `// تعليق\n${client}`)).not.toEqual([]);
  });

  it("يقبل الواجهة المسموحة", () => {
    const ok = 'import Link from "next/link";\nimport { SectionShell, type BlockProps } from "@/stores-kit";\nimport { Star } from "lucide-react";';
    expect(msgs("stores/a/blocks/x.tsx", ok)).toEqual([]);
  });
});

describe("سجل المتاجر المولَّد", () => {
  it("المرفوع يطابق مجلدات stores/ (npm run stores:registry)", () => {
    const { code, errors } = generate();
    expect(errors).toEqual([]);
    expect(readFileSync("src/stores/registry.generated.ts", "utf8")).toBe(code);
  });

  it("ما يخص متجراً لا يظهر في غيره", async () => {
    expect(await loadBlock("atelier", "craft-process")).toBeTypeOf("function");
    expect(await loadBlock("nova", "craft-process")).toBeNull();
    expect(await loadSlot("atelier", "Header")).toBeTypeOf("function");
    expect(await loadSlot("nova", "Header")).toBeNull();
    expect(await loadSectionOverride("nova", "faq")).toBeTypeOf("function");
    expect(await loadSectionOverride("atelier", "faq")).toBeNull();
    expect(await loadPage("atelier", "craft")).not.toBeNull();
    expect(await loadPage("nova", "craft")).toBeNull();
    expect(storeTheme("atelier")).toContain("--atelier-clay");
    expect(storeTheme("nova")).not.toContain("atelier");
  });

  it("متجر بلا مجلد يُعرض بالنواة، ومفاتيح الكائنات لا تُعامل كمتاجر", async () => {
    expect(storeEntry("no-such-store")).toBeNull();
    expect(storeEntry("constructor")).toBeNull();
    expect(storeEntry("__proto__")).toBeNull();
    expect(await loadBlock("atelier", "constructor")).toBeNull();
    expect(await loadPage("atelier", "toString")).toBeNull();
  });

  it("blueprint.json وseed.json في السجل صالحان لمخططيهما («جهّز المتجر» يزرعهما)، ومتجر بلا ملفات = null", async () => {
    for (const slug of Object.keys(STORE_REGISTRY)) {
      const { blueprint, seed } = await storeFolderData(slug);
      if (blueprint) expect(blueprintSchema.safeParse(blueprint).success, slug).toBe(true);
      if (seed) expect(storeSeedSchema.safeParse(seed).success, slug).toBe(true);
      expect(hasFolderData(slug)).toBe(Boolean(blueprint || seed));
    }
    expect(await storeFolderData("no-such-store")).toEqual({ blueprint: null, seed: null });
    expect(hasFolderData("__proto__")).toBe(false);
  });

  it("مشروع التاجر المستقل لا يحمل مجلدات المتاجر الأخرى", () => {
    const overlay = readFileSync("template/src/stores/registry.generated.ts", "utf8");
    expect(importSpecs(overlay).filter((s) => s.includes("stores/"))).toEqual([]);
  });
});
