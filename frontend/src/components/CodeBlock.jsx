import { useSettings } from "../contexts/SettingsContext";

export function CodeBlock({ children }) {
  const { settings } = useSettings();
  const showNumbers = !!settings.show_line_numbers;
  const text = typeof children === "string" ? children : "";

  if (!showNumbers) {
    return (
      <pre className="overflow-x-auto rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-subtle)] p-4 font-mono text-xs leading-relaxed">
        <code>{text}</code>
      </pre>
    );
  }

  const lines = text.split("\n");
  return (
    <div className="overflow-hidden rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-subtle)]">
      <div className="flex overflow-x-auto font-mono text-xs leading-relaxed">
        {/* Line numbers column */}
        <div className="select-none border-r border-[var(--color-border-muted)] px-3 py-4 text-right text-[var(--color-fg-muted)]">
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        {/* Code column */}
        <pre className="flex-1 p-4">
          <code>{text}</code>
        </pre>
      </div>
    </div>
  );
}
