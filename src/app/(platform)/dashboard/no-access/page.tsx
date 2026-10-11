// dashboard/no-access — عضو فريق بلا أي صلاحية عرض (أزالها صاحب المتجر).
import { Lock } from "lucide-react";

export const metadata = { title: "لا صلاحيات" };

export default function NoAccess() {
  return (
    <div className="mx-auto grid min-h-[50vh] max-w-md place-items-center text-center">
      <div className="space-y-3">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-edge/[0.06] text-ink-2">
          <Lock className="size-6" aria-hidden="true" />
        </span>
        <h1 className="text-xl font-black text-ink">لا صلاحيات لك في هذا المتجر الآن</h1>
        <p className="text-[14px] leading-7 text-ink-2">اطلب من صاحب المتجر أن يمنحك صلاحية من «فريق المتجر».</p>
      </div>
    </div>
  );
}
