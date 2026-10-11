// مراحل صناعة القطعة: مكوّن خاص بأتيليه طين وحده، يوضع في الصفحة بقسم { type: "store_block", name: "craft-process" }.
import { SectionShell, SectionHeading, Icon, type BlockProps } from "@/stores-kit";

type Props = { days?: number };

const STEPS = [
  { icon: "hand", title: "التشكيل", text: "كل قطعة تُشكَّل على الدولاب باليد." },
  { icon: "sun", title: "التجفيف", text: "تجف ببطء في الظل حتى لا تتشقق." },
  { icon: "flame", title: "الحرق", text: "حرقتان في الفرن قبل التزجيج وبعده." },
  { icon: "package", title: "التغليف", text: "تغليف مزدوج يحميها في الطريق إليك." },
];

export default async function CraftProcess({ s, props, kit }: BlockProps<Props>) {
  const products = await kit.data.products({ source: { type: "featured" }, limit: 3 });
  const days = typeof props.days === "number" && props.days > 0 ? props.days : null;
  return (
    <SectionShell s={s}>
      <SectionHeading
        title={s.title ?? "كيف تُصنع قطعتك"}
        subtitle={days ? `من الطين إلى بابك في نحو ${days} أيام عمل.` : undefined}
      />
      <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-atelier-block="craft-process">
        {STEPS.map((step, i) => (
          <li key={step.title} className="atelier-step p-5">
            <span className="text-xs font-bold opacity-60">{i + 1}</span>
            <Icon name={step.icon} className="mt-2 block" size={26} />
            <h3 className="mt-3 text-lg font-bold">{step.title}</h3>
            <p className="mt-1 text-sm opacity-80">{step.text}</p>
          </li>
        ))}
      </ol>
      {products.length ? (
        <p className="mt-6 text-sm opacity-70">من الأفران هذا الأسبوع: {products.map((p) => p.name).join("، ")}</p>
      ) : null}
    </SectionShell>
  );
}
