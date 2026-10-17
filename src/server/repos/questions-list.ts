// questions-list.ts — أسئلة الزوار عن المنتجات لإدارتها في اللوحة (بانتظار، مجاب، مخفي). بيانات المتجر نفسه فقط.
import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { productQuestions, products } from "@/db/schema";

export type QuestionTab = "pending" | "answered" | "hidden";
export type QuestionRow = {
  id: string;
  productId: string;
  productName: string;
  question: string;
  answer: string | null;
  askerName: string | null;
  askerPhone: string | null;
  createdAt: string;
};

export async function questionsData(storeId: string, tab: QuestionTab): Promise<{ rows: QuestionRow[]; counts: Record<QuestionTab, number> }> {
  const db = await getTenantDb(storeId);
  const [rows, counts] = await Promise.all([
    db
      .select({ q: productQuestions, productName: products.name })
      .from(productQuestions)
      .innerJoin(products, and(eq(products.id, productQuestions.productId), eq(products.storeId, storeId)))
      .where(and(eq(productQuestions.storeId, storeId), eq(productQuestions.status, tab)))
      .orderBy(tab === "pending" ? productQuestions.createdAt : desc(productQuestions.createdAt))
      .limit(100),
    db
      .select({ status: productQuestions.status, n: sql<number>`count(*)::int` })
      .from(productQuestions)
      .where(eq(productQuestions.storeId, storeId))
      .groupBy(productQuestions.status),
  ]);
  const c = { pending: 0, answered: 0, hidden: 0 } as Record<QuestionTab, number>;
  for (const r of counts) c[r.status as QuestionTab] = Number(r.n) || 0;
  return {
    rows: rows.map(({ q, productName }) => ({
      id: q.id,
      productId: q.productId,
      productName,
      question: q.question,
      answer: q.answer,
      askerName: q.askerName,
      askerPhone: q.askerPhone,
      createdAt: q.createdAt.toISOString(),
    })),
    counts: c,
  };
}
