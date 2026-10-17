import "server-only";
// extract.ts — قراءة ملف رفعه التاجر إلى ما تفهمه أداة الاستيراد: جدول (xlsx/csv)، نص (txt/docx)، صورة، أو PDF.
// لا نعتمد على مكتبات ثقيلة: xlsx عبر exceljs (موجود)، وdocx بفك الضغط وقراءة نص document.xml، وPDF يُقرأ بالمسار البصري.
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { parseCsv } from "@/lib/csv-parse";
import { sniffImageType } from "@/lib/media";

export const IMPORT_FILE_MAX_BYTES = 12 * 1024 * 1024;
const TABLE_MAX_ROWS = 2000;
const TEXT_MAX_CHARS = 120_000;

export type Extracted =
  | { kind: "table"; table: string[][] }
  | { kind: "text"; text: string }
  | { kind: "image"; type: string }
  | { kind: "pdf" }
  | { kind: "unsupported"; reason: string };

const ext = (name: string) => (/\.([a-z0-9]+)$/i.exec(name)?.[1] ?? "").toLowerCase();
const startsWith = (b: Uint8Array, sig: number[]) => sig.every((v, i) => b[i] === v);

const decodeEntities = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");

/** يفك نص ملف Word: الفقرات أسطر، وخلايا الجداول مفصولة بفواصل. */
export async function docxText(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) throw new Error("not_docx");
  return decodeEntities(
    xml
      .replace(/<\/w:tc>/g, " ، ")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<w:tab\/>/g, " ")
      .replace(/<w:br[^>]*\/>/g, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/ ، \n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, TEXT_MAX_CHARS);
}

async function xlsxTable(bytes: Uint8Array): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);
  const ws = wb.worksheets.find((w) => w.rowCount > 1) ?? wb.worksheets[0];
  if (!ws) return [];
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n > TABLE_MAX_ROWS) return;
    const cells: string[] = [];
    for (let i = 1; i <= Math.min(row.cellCount, 40); i++) {
      const c = row.getCell(i);
      const v = c.value;
      // الصيغ تُقرأ بنتيجتها، والتاريخ ISO.
      cells.push(v instanceof Date ? v.toISOString().slice(0, 10) : String(c.text ?? "").trim());
    }
    rows.push(cells);
  });
  return rows;
}

export async function extractFile(name: string, claimedType: string, bytes: Uint8Array): Promise<Extracted> {
  if (bytes.byteLength === 0) return { kind: "unsupported", reason: "الملف فارغ" };
  if (bytes.byteLength > IMPORT_FILE_MAX_BYTES) return { kind: "unsupported", reason: "الملف أكبر من 12 ميجابايت. قسّموه إلى ملفات أصغر" };
  const e = ext(name);

  const img = sniffImageType(bytes);
  if (img) return { kind: "image", type: img };
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return { kind: "pdf" }; // %PDF

  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    // zip: xlsx أو docx
    try {
      if (e === "docx" || claimedType.includes("wordprocessingml")) return { kind: "text", text: await docxText(bytes) };
      return { kind: "table", table: await xlsxTable(bytes) };
    } catch {
      try {
        return { kind: "text", text: await docxText(bytes) };
      } catch {
        return { kind: "unsupported", reason: "تعذر فتح الملف. تأكدوا أنه Excel أو Word سليم" };
      }
    }
  }
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0])) return { kind: "unsupported", reason: "صيغة Office القديمة (xls/doc) غير مدعومة. احفظوه من البرنامج بصيغة xlsx أو docx ثم ارفعوه" };

  // نصي: CSV / TSV / TXT (UTF-8 مع إزالة BOM، وسقوط على windows-1256 العربي عند ظهور رموز تالفة).
  let text = new TextDecoder("utf-8").decode(bytes).replace(/^﻿/, "");
  if (text.includes("�")) text = new TextDecoder("windows-1256").decode(bytes);
  if (text.includes("\u0000")) return { kind: "unsupported", reason: "صيغة الملف غير مدعومة. استخدموا Excel أو CSV أو PDF أو Word أو نصاً أو صوراً" };
  text = text.slice(0, TEXT_MAX_CHARS);
  if (e === "csv" || e === "tsv" || /text\/(csv|tab)/.test(claimedType)) {
    const t = e === "tsv" || /\t/.test(text.split("\n")[0] ?? "") ? text.split(/\r?\n/).map((l) => l.split("\t")) : parseCsv(text);
    return { kind: "table", table: t.slice(0, TABLE_MAX_ROWS) };
  }
  return { kind: "text", text };
}
