/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: "var(--color-canvas-default)",
          subtle: "var(--color-canvas-subtle)",
          inset: "var(--color-canvas-inset)",
        },
        fg: {
          DEFAULT: "var(--color-fg-default)",
          muted: "var(--color-fg-muted)",
          subtle: "var(--color-fg-subtle)",
        },
        border: {
          DEFAULT: "var(--color-border-default)",
          muted: "var(--color-border-muted)",
        },
        accent: {
          DEFAULT: "var(--color-accent-fg)",
          emphasis: "var(--color-accent-emphasis)",
          subtle: "var(--color-accent-subtle)",
        },
        success: {
          DEFAULT: "var(--color-success-fg)",
          emphasis: "var(--color-success-emphasis)",
          subtle: "var(--color-success-subtle)",
        },
        danger: {
          DEFAULT: "var(--color-danger-fg)",
          emphasis: "var(--color-danger-emphasis)",
          subtle: "var(--color-danger-subtle)",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system", "BlinkMacSystemFont", "Segoe UI",
          "Noto Sans", "Helvetica", "Arial", "sans-serif",
        ],
        mono: [
          "ui-monospace", "SFMono-Regular", "SF Mono",
          "Menlo", "Consolas", "Liberation Mono", "monospace",
        ],
      },
    },
  },
  plugins: [],
};
