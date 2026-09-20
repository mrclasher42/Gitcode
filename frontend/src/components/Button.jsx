import { cn } from "../lib/cn";

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-md font-medium " +
  "leading-none whitespace-nowrap cursor-pointer select-none " +
  "border transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const variants = {
  default:
    "bg-[var(--color-btn-bg)] text-[var(--color-btn-fg)] " +
    "border-[var(--color-btn-border)] " +
    "hover:bg-[var(--color-btn-hover-bg)] active:bg-[var(--color-btn-active-bg)]",
  primary:
    "bg-[var(--color-btn-primary-bg)] text-[var(--color-btn-primary-fg)] " +
    "border-[rgba(31,35,40,0.15)] " +
    "hover:bg-[var(--color-btn-primary-hover-bg)]",
  danger:
    "bg-[var(--color-btn-danger-bg)] text-[var(--color-btn-danger-fg)] " +
    "border-[rgba(31,35,40,0.15)] " +
    "hover:bg-[var(--color-btn-danger-hover-bg)]",
  ghost:
    "bg-transparent text-[var(--color-fg-default)] border-transparent " +
    "hover:bg-[var(--color-btn-hover-bg)]",
};

const sizes = {
  xs: "h-6 px-2 text-xs",
  sm: "h-7 px-2.5 text-xs sm:h-8 sm:px-3 sm:text-sm",
  md: "h-8 px-3.5 text-sm",
  lg: "h-10 px-5 text-base",
  icon: "h-8 w-8 p-0",
};

export function Button({
  variant = "default",
  size = "md",
  className,
  as: Tag = "button",
  ...props
}) {
  return (
    <Tag
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
}
