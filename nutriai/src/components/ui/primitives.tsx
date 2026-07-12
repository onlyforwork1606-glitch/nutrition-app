import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

/* ----------------------------- GlassCard ----------------------------- */

type GlassCardProps = HTMLMotionProps<"div"> & {
  children: ReactNode;
  glow?: boolean;
};

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, children, glow, ...props }, ref) => (
    <motion.div
      ref={ref}
      className={cn(
        "glass rounded-3xl p-5",
        glow && "shadow-[0_0_60px_-12px_rgba(139,92,246,0.5)]",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  )
);
GlassCard.displayName = "GlassCard";

/* ------------------------------ Button ------------------------------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "glass" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => {
    const base =
      "relative inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-all active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none select-none";
    const sizes: Record<string, string> = {
      sm: "text-sm px-3 py-2",
      md: "text-sm px-5 py-3",
      lg: "text-base px-6 py-4",
    };
    const variants: Record<string, string> = {
      primary:
        "bg-linear-to-br from-violet-500 to-cyan-400 text-white shadow-[0_8px_30px_-8px_rgba(139,92,246,0.7)]",
      glass: "glass-soft text-white hover:bg-white/10",
      ghost: "text-white/70 hover:text-white hover:bg-white/5",
      danger: "bg-red-500/20 text-red-200 border border-red-400/30 hover:bg-red-500/30",
    };
    return (
      <button
        ref={ref}
        className={cn(base, sizes[size], variants[variant], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

/* --------------------------- ProgressRing ---------------------------- */

export function ProgressRing({
  value,
  max,
  size = 120,
  stroke = 10,
  label,
  sublabel,
  gradient = ["#a78bfa", "#22d3ee"],
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  label?: ReactNode;
  sublabel?: ReactNode;
  gradient?: [string, string];
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const id = `grad-${gradient.join("")}-${size}`;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={gradient[0]} />
            <stop offset="100%" stopColor={gradient[1]} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - pct * c }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {label}
        {sublabel && <div className="text-[11px] text-white/50">{sublabel}</div>}
      </div>
    </div>
  );
}

/* ----------------------------- StatCard ------------------------------ */

export function StatCard({
  icon,
  label,
  value,
  unit,
  accent = "#a78bfa",
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  unit?: string;
  accent?: string;
}) {
  return (
    <GlassCard className="flex flex-col gap-1 p-4">
      <div className="flex items-center gap-2 text-white/60 text-xs">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold" style={{ color: accent }}>
        {value}
        {unit && <span className="text-sm font-medium text-white/40 ml-1">{unit}</span>}
      </div>
    </GlassCard>
  );
}

/* ------------------------------ Field -------------------------------- */

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-white/60">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-white/40">{hint}</span>}
    </label>
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-violet-400/60 focus:bg-white/10 transition",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-violet-400/60 focus:bg-white/10 transition resize-none",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

/* ----------------------------- Skeleton ------------------------------ */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-2xl", className)} />;
}

/* ---------------------------- Segmented ------------------------------ */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="glass-soft inline-flex rounded-2xl p-1 gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "px-3 py-1.5 rounded-xl text-sm font-medium transition",
            value === o.value
              ? "bg-white/15 text-white"
              : "text-white/50 hover:text-white"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
