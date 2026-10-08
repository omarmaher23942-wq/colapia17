import { Markdown } from "@/components/storefront/Markdown";

export const metadata = { title: "تعليمات حذف البيانات | Colapia" };

const BODY = `## Data Deletion Instructions
If you wish to request the deletion of your personal or business data processed by Colapia via our Facebook Page or Instagram integration, you may do so easily:

1. **Via Messenger:** Send a message to our Page stating "حذف بياناتي" or "Delete my data".
2. **Via Email:** Send an email to **privacy@colapia.com** containing your Page name and profile link.

Upon receiving your request, all personal conversations, uploaded media, and non-activated store blueprints will be permanently purged within 7 business days.`;

export default function DataDeletion() {
  return (
    <article className="container-x max-w-3xl py-12">
      <h1 className="mb-6 text-3xl font-black">تعليمات حذف البيانات</h1>
      <Markdown text={BODY} />
    </article>
  );
}