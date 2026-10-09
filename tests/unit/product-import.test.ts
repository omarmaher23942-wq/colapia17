import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv-parse";
import { IMPORT_TEMPLATE, mapHeader, parseNumber, planImport } from "@/lib/product-import";

describe("parseCsv", () => {
  it("handles quotes, commas and new lines inside cells, BOM and CRLF", () => {
    const rows = parseCsv('﻿name,description\r\n"فستان ""مميز""","سطر أول، ثاني\nسطر ثالث"\r\n');
    expect(rows).toEqual([
      ["name", "description"],
      ['فستان "مميز"', "سطر أول، ثاني\nسطر ثالث"],
    ]);
  });

  it("detects semicolon-separated files saved by Excel", () => {
    expect(parseCsv("الاسم;السعر\nقميص;250")).toEqual([
      ["الاسم", "السعر"],
      ["قميص", "250"],
    ]);
  });

  it("drops fully empty lines", () => {
    expect(parseCsv("a,b\n,\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("product import", () => {
  it("maps Arabic and English headers", () => {
    expect(mapHeader(["اسم المنتج", "Price", "الكمية", "سعر التكلفة", "unknown"])).toEqual({ name: 0, price: 1, stock: 2, cost: 3 });
  });

  it.each([
    ["1,250", 1250],
    ["١٢٥٠", 1250],
    ["450 ج.م", 450],
    ["99.5", 99.5],
    ["", null],
  ])("parses %s", (raw, n) => expect(parseNumber(raw)).toBe(n));

  it("validates rows with Arabic messages and line numbers", () => {
    const plan = planImport(
      parseCsv(
        [
          "الاسم,السعر,السعر قبل الخصم,الكمية,الصور",
          "قميص,250,200,10,http://x.com/a.jpg https://x.com/b.jpg",
          ",abc,,1.5,",
          "حذاء,700,,,",
        ].join("\n")
      )
    );
    expect(plan.missingColumns).toEqual([]);
    const [a, b, c] = plan.rows;
    expect(a!.line).toBe(2);
    expect(a!.compareAtPiasters).toBeNull();
    expect(a!.warnings).toHaveLength(2);
    expect(a!.images).toEqual(["https://x.com/b.jpg"]);
    expect(a!.stock).toBe(10);
    expect(b!.errors).toEqual(["الاسم فارغ", "السعر «abc» غير صالح", "الكمية «1.5» يجب أن تكون عدداً صحيحاً"]);
    expect(c!.stock).toBeNull();
    expect(c!.pricePiasters).toBe(70_000);
  });

  it("reports a file without the required columns", () => {
    expect(planImport([["title", "cost"]]).missingColumns).toEqual(["price"]);
    expect(planImport([["product title", "cost"]]).missingColumns).toEqual(["name", "price"]);
  });

  it("ships a template that imports cleanly", () => {
    const plan = planImport(parseCsv(IMPORT_TEMPLATE));
    expect(plan.rows).toHaveLength(2);
    expect(plan.rows.every((r) => r.errors.length === 0)).toBe(true);
  });
});
