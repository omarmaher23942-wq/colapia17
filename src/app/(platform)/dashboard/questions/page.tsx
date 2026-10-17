// dashboard/questions — إدارة أسئلة الزوار عن المنتجات (مجال المنتجات).
import { requireStoreArea } from "@/server/merchant-guard";
import { questionsData, type QuestionTab } from "@/server/repos/questions-list";
import { QuestionsManager } from "@/components/dashboard/questions/QuestionsManager";
import { publicStoreUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "أسئلة المنتجات" };

export default async function QuestionsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const access = await requireStoreArea("products");
  const sp = await searchParams;
  const tab: QuestionTab = sp.tab === "answered" ? "answered" : sp.tab === "hidden" ? "hidden" : "pending";
  const data = await questionsData(access.store.id, tab).catch(() => ({ rows: [], counts: { pending: 0, answered: 0, hidden: 0 } }));
  return <QuestionsManager tab={tab} rows={data.rows} counts={data.counts} storeName={access.store.name} storeUrl={publicStoreUrl(access.store)} />;
}
