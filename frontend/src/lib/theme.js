const KEY = "gc-theme";

export function getStoredTheme() {
  return localStorage.getItem(KEY);
}

export function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getEffectiveTheme() {
  return getStoredTheme() || getSystemTheme();
}

export function setTheme(theme) {
  localStorage.setItem(KEY, theme);
  document.documentElement.setAttribute("data-color-mode", theme);
}

export function toggleTheme() {
  const next = getEffectiveTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}
