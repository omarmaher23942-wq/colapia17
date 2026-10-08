"use client";
import { useEffect, useState, type ReactNode } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
  type Variants,
} from "motion/react";
import { cn } from "@/lib/utils";
import { PRESSABLE, SPRING, VIEWPORT_ONCE, fadeUp, stagger } from "@/lib/motion";

type Tag = "div" | "section" | "ul" | "ol" | "li" | "span" | "article" | "header" | "nav" | "aside";

/** حاوية كشف تتابعي: الأبناء StaggerItem يظهرون واحدًا بعد الآخر */
export function Stagger({
  children,
  className,
  as = "div",
  delay = 0,
  gap = 0.06,
  inView = true,
}: {
  children: ReactNode;
  className?: string;
  as?: Tag;
  delay?: number;
  gap?: number;
  /** true: يبدأ عند الظهور في الشاشة. false: يبدأ فور التركيب */
  inView?: boolean;
}) {
  const M = motion[as];
  const reduce = useReducedMotion();
  return (
    <M
      className={className}
      variants={stagger(gap, delay)}
      initial={reduce ? false : "hidden"}
      {...(inView ? { whileInView: "show", viewport: VIEWPORT_ONCE } : { animate: "show" })}
    >
      {children}
    </M>
  );
}

/** عنصر داخل Stagger */
export function StaggerItem({
  children,
  className,
  as = "div",
  variants = fadeUp,
}: {
  children: ReactNode;
  className?: string;
  as?: Tag;
  variants?: Variants;
}) {
  const M = motion[as];
  return (
    <M className={className} variants={variants}>
      {children}
    </M>
  );
}

/** ظهور مفرد (بدون تتابع) */
export function FadeIn({
  children,
  className,
  as = "div",
  delay = 0,
  variants = fadeUp,
  inView = true,
}: {
  children: ReactNode;
  className?: string;
  as?: Tag;
  delay?: number;
  variants?: Variants;
  inView?: boolean;
}) {
  const M = motion[as];
  const reduce = useReducedMotion();
  return (
    <M
      className={className}
      variants={variants}
      initial={reduce ? false : "hidden"}
      transition={{ delay }}
      {...(inView ? { whileInView: "show", viewport: VIEWPORT_ONCE } : { animate: "show" })}
    >
      {children}
    </M>
  );
}

/** غلاف دخول/خروج للقوائم والحالات المتغيرة (Kanban، إشعارات، تبويبات) */
export function Presence({
  children,
  mode = "popLayout",
  initial = false,
}: {
  children: ReactNode;
  mode?: "sync" | "wait" | "popLayout";
  initial?: boolean;
}) {
  return (
    <AnimatePresence mode={mode} initial={initial}>
      {children}
    </AnimatePresence>
  );
}

/** عنصر يستجيب للضغط والتحويم بفيزياء نابض */
export function Pressable({
  children,
  className,
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={cn("inline-block", className)}
      onClick={disabled ? undefined : onClick}
      {...(reduce || disabled ? {} : PRESSABLE)}
    >
      {children}
    </motion.div>
  );
}

/** طي/فتح بارتفاع تلقائي (أقسام الإعدادات، تفاصيل الطلب) */
export function Collapse({ open, children, className }: { open: boolean; children: ReactNode; className?: string }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="collapse"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={SPRING.gentle}
          className={cn("overflow-hidden", className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const defaultFormat = (n: number) => Math.round(n).toLocaleString("en");

/**
 * رقم يتحرك بنابض عند تغيّر قيمته (بطاقات الإحصائيات، إجمالي السلة).
 * from: نقطة البداية عند التركيب (0 لعدّاد تصاعدي، أو اتركها لتبدأ من القيمة مباشرة)
 */
export function AnimatedNumber({
  value,
  from,
  format = defaultFormat,
  className,
}: {
  value: number;
  from?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(from ?? value);
  const spring = useSpring(mv, { stiffness: 90, damping: 22 });
  const [text, setText] = useState(() => format(from ?? value));

  useEffect(() => {
    if (reduce) spring.jump(value);
    else mv.set(value);
  }, [value, mv, spring, reduce]);

  useMotionValueEvent(spring, "change", (v) => setText(format(v)));

  return <span className={cn("tabular", className)}>{text}</span>;
}
