import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent-hover",
  secondary: "bg-surface text-fg border border-border-strong hover:bg-surface-2",
  ghost: "bg-transparent text-fg-muted hover:bg-surface-2",
  danger: "bg-red-bg text-red hover:bg-red-bg",
};

const SIZE: Record<Size, string> = {
  sm: "px-[11px] py-[5px] text-xs",
  md: "px-[15px] py-2 text-[13px]",
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-[6px] rounded-lg font-semibold transition-colors ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...props}
    />
  );
}
