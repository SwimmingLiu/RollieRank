import { Progress } from "@base-ui/react/progress";
import { motion, useReducedMotion } from "motion/react";
import type { ComponentProps, ReactNode } from "react";
import { NumberTicker as BeuiNumberTicker } from "./components/motion/number-ticker";
import { useLocale } from "./lib/i18n";
import { EASE_OUT } from "./lib/ease";
import { cn } from "./lib/utils";

// Keep the actual registry controls available to every page; wrappers below only
// add deterministic export rendering and a shared progress presentation contract.
export { Avatar } from "./components/motion/avatar-group";
export type { AvatarProps } from "./components/motion/avatar-group";
export { AnimatedBadge as Badge } from "./components/motion/animated-badge";
export type { AnimatedBadgeProps as BadgeProps } from "./components/motion/animated-badge";
export { Input as TextInput } from "./components/motion/input";
export type { InputProps as TextInputProps } from "./components/motion/input";
export { ScrollArea } from "@base-ui/react/scroll-area";

export type NumberTickerProps = ComponentProps<typeof BeuiNumberTicker> & {
  /** Static output is needed while rasterizing a finished scorecard. */
  animated?: boolean;
};

export function NumberTicker({ animated = true, ...props }: NumberTickerProps) {
  const reduce = useReducedMotion();
  const { locale: contextLocale } = useLocale();
  if (animated && !reduce) return <BeuiNumberTicker duration={0.65} {...props} />;

  // The static path uses the registry's same rounding/formatting contract, so
  // exports and reduced-motion views never capture the entrance's zero digits.
  const places = Math.max(0, Math.floor(props.decimals ?? 0));
  const factor = 10 ** places;
  const rounded = Math.round(props.value * factor) / factor;
  const formatted = props.format
    ? props.format(rounded)
    : props.locale
      ? rounded.toLocaleString(typeof props.locale === "string" ? props.locale : contextLocale, {
          minimumFractionDigits: places,
          maximumFractionDigits: places,
        })
      : rounded.toFixed(places);
  const text = props.pad ? formatted.padStart(props.pad, "0") : formatted;
  const readable = `${props.prefix ?? ""}${text}${props.suffix ?? ""}`;
  return <span className={cn("inline-flex items-baseline tabular-nums", props.className)} data-slot="number-ticker-static">{readable}</span>;
}

export type ProgressBarProps = {
  value: number;
  max?: number;
  label: string;
  valueText?: string;
  className?: string;
  trackClassName?: string;
  indicatorClassName?: string;
  animated?: boolean;
};

function progressRange(value: number, max: number) {
  // This UI boundary normalizes once for both the accessible range and the
  // drawing, instead of allowing a clipped visual and an out-of-range label.
  const maximum = Number.isFinite(max) && max > 0 ? max : 100;
  const current = Number.isFinite(value) ? Math.min(maximum, Math.max(0, value)) : 0;
  return { current, maximum, ratio: current / maximum };
}

export function ProgressBar({ value, max = 100, label, valueText, className, trackClassName, indicatorClassName, animated = true }: ProgressBarProps) {
  const reduce = useReducedMotion();
  const animate = animated && !reduce;
  const { current, maximum, ratio } = progressRange(value, max);
  return (
    <Progress.Root value={current} max={maximum} aria-label={label} aria-valuetext={valueText} className={cn("rr2-progress-bar", className)} data-slot="progress-bar">
      <Progress.Track className={cn("rr2-progress-track overflow-hidden rounded-full bg-muted", trackClassName)} style={{ height: 6 }}>
        <Progress.Indicator
          className={cn("rr2-progress-indicator h-full rounded-full bg-current", indicatorClassName)}
          style={{ width: `${ratio * 100}%`, transition: animate ? "width 420ms cubic-bezier(.16,1,.3,1)" : "none" }}
          render={<motion.div initial={animate ? { scaleX: 0 } : false} animate={{ scaleX: 1 }} transition={{ duration: animate ? 0.5 : 0, ease: EASE_OUT }} style={{ transformOrigin: "left" }} />}
        />
      </Progress.Track>
    </Progress.Root>
  );
}

export type ProgressRingProps = Omit<ProgressBarProps, "trackClassName" | "indicatorClassName"> & {
  children?: ReactNode;
  size?: number;
  strokeWidth?: number;
};

export function ProgressRing({ value, max = 100, label, valueText, className, animated = true, children, size = 96, strokeWidth = 5 }: ProgressRingProps) {
  const reduce = useReducedMotion();
  const animate = animated && !reduce;
  const { current, maximum, ratio } = progressRange(value, max);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - ratio);
  const circle = {
    cx: 50, cy: 50, r: radius, fill: "none", stroke: "currentColor",
    strokeWidth, strokeDasharray: circumference, strokeLinecap: "round",
    transform: "rotate(-90 50 50)",
  } satisfies ComponentProps<"circle">;
  return (
    <Progress.Root value={current} max={maximum} aria-label={label} aria-valuetext={valueText} className={cn("rr2-progress-ring", className)} data-slot="progress-ring" style={{ width: size, height: size, display: "inline-grid", placeItems: "center" }}>
      <svg viewBox="0 0 100 100" aria-hidden="true" style={{ width: "100%", height: "100%", gridArea: "1 / 1" }}>
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--rr-progress-track, var(--beui-muted, #f0f0f2))" strokeWidth={strokeWidth} />
        {animate
          ? <motion.circle {...circle} initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: offset }} transition={{ duration: 0.65, ease: EASE_OUT }} />
          : <circle {...circle} strokeDashoffset={offset} />}
      </svg>
      {children !== undefined ? <span className="rr2-progress-ring-copy" style={{ gridArea: "1 / 1", zIndex: 1 }}>{children}</span> : null}
    </Progress.Root>
  );
}

export { ProgressBar as Meter };
