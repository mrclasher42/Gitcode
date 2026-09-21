import { useEffect, useRef, useState } from "react";
import { ChevronDown, Copy, Check, Code2 } from "lucide-react";
import { cn } from "../lib/cn";

const TABS = ["HTTPS", "SSH", "GitCode CLI"];

async function copyToClipboard(text) {
  // Modern API (requires HTTPS or localhost)
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {}
  }
  // Fallback: textarea + execCommand
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "absolute";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function CloneMenu({ owner, name }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("HTTPS");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const host = window.location.hostname;
  const urls = {
    "HTTPS": `https://${host}:8080/${owner}/${name}`,
    "SSH": `git@${host}:${owner}/${name}.git`,
    "GitCode CLI": `gc clone ${owner}/${name}`,
  };

  async function handleCopy() {
    setCopyError(false);
    const ok = await copyToClipboard(urls[tab]);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } else {
      setCopyError(true);
      setTimeout(() => setCopyError(false), 2000);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border border-[rgba(31,35,40,0.15)] bg-[var(--color-btn-primary-bg)] px-3 text-sm font-medium text-[var(--color-btn-primary-fg)] hover:bg-[var(--color-btn-primary-hover-bg)]"
      >
        <Code2 size={14} />
        <span>Code</span>
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-1 w-[320px] rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] p-3 shadow-lg sm:w-[440px]">
          <div className="mb-2 flex gap-1 border-b border-[var(--color-border-muted)]">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "-mb-px border-b-2 px-2 py-1.5 text-xs font-medium",
                  tab === t
                    ? "border-[var(--color-accent-fg)] text-[var(--color-fg-default)]"
                    : "border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg-default)]"
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <input
              readOnly
              value={urls[tab]}
              onFocus={(e) => e.target.select()}
              onClick={(e) => e.target.select()}
              className="h-8 flex-1 rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-subtle)] px-2 font-mono text-xs text-[var(--color-fg-default)] outline-none"
            />
            <button
              type="button"
              onClick={handleCopy}
              title="Copy"
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-md border",
                copied
                  ? "border-[var(--color-success-emphasis)] bg-[var(--color-success-subtle)] text-[var(--color-success-fg)]"
                  : "border-[var(--color-border-default)] bg-[var(--color-btn-bg)] hover:bg-[var(--color-btn-hover-bg)]"
              )}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>

          <p className="mt-2 text-xs text-[var(--color-fg-muted)]">
            {copyError
              ? "Copy failed. Select the text manually."
              : tab === "HTTPS"
              ? "Clone using HTTPS."
              : tab === "SSH"
              ? "Clone using SSH."
              : "Clone using the GitCode CLI."}
          </p>
        </div>
      )}
    </div>
  );
}
