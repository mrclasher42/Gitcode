import { cn } from "../lib/cn";

const base =
  "inline-flex items-center justify-center h-8 w-8 p-0 rounded-md " +
  "bg-transparent border border-transparent cursor-pointer " +
  "text-[var(--color-fg-default)] transition-colors " +
  "hover:bg-[var(--color-btn-hover-bg)] hover:border-[var(--color-border-default)]";

export function IconButton({ className, children, ...props }) {
  return (
    <button type="button" className={cn(base, className)} {...props}>
      {children}
    </button>
  );
}
