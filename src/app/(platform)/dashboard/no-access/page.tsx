// dashboard/no-access — عضو فريق بلا أي صلاحية عرض (أزالها صاحب المتجر)، أو متجر مقفل (مجمّد/متوقف) والاشتراك لصاحبه وحده.
import { Lock } from "lucide-react";

export const metadata = { title: "لا صلاحيات" };

export default async function NoAccess({ searchParams }: { searchParams: Promise<{ locked?: string }> }) {
  const { locked } = await searchParams;
  return (
    <div className="mx-auto grid min-h-[50vh] max-w-md place-items-center text-center">
      <div className="space-y-3">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-edge/[0.06] text-ink-2">
          <Lock className="size-6" aria-hidden="true" />
        </span>
        {locked ? (
          <>
            <h1 className="text-xl font-black text-ink">لوحة المتجر مقفلة مؤقتاً</h1>
            <p className="text-[14px] leading-7 text-ink-2">انتهت التجربة أو الاشتراك، وتعود اللوحة كما كانت بمجرد أن يكمل صاحب المتجر الدفع. كل البيانات محفوظة.</p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-black text-ink">لا صلاحيات في هذا المتجر الآن</h1>
            <p className="text-[14px] leading-7 text-ink-2">يمكن طلب الصلاحية من صاحب المتجر من «فريق المتجر».</p>
          </>
        )}
      </div>
    </div>
  );
}
