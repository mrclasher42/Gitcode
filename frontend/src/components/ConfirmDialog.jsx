import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";

export function ConfirmDialog({
  title = "Are you sure?",
  message = "",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  danger = false,
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onConfirm, onCancel]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-sm rounded-lg border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start gap-3">
          <div
            className={
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full " +
              (danger
                ? "bg-[var(--color-danger-subtle)] text-[var(--color-danger-fg)]"
                : "bg-[var(--color-accent-subtle)] text-[var(--color-accent-fg)]")
            }
          >
            <AlertTriangle size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold">{title}</h3>
            {message && (
              <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{message}</p>
            )}
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-btn-bg)] px-3 py-1.5 text-sm hover:bg-[var(--color-btn-hover-bg)]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              "rounded-md border px-3 py-1.5 text-sm font-medium " +
              (danger
                ? "border-[rgba(31,35,40,0.15)] bg-[var(--color-btn-danger-bg)] text-[var(--color-btn-danger-fg)] hover:bg-[var(--color-btn-danger-hover-bg)]"
                : "border-[rgba(31,35,40,0.15)] bg-[var(--color-btn-primary-bg)] text-[var(--color-btn-primary-fg)] hover:bg-[var(--color-btn-primary-hover-bg)]")
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
