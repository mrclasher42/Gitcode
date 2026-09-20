import { useEffect, useState } from "react";
import { getEffectiveTheme, toggleTheme } from "../lib/theme";

export function useTheme() {
  const [theme, setThemeState] = useState(getEffectiveTheme());

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (!localStorage.getItem("gc-theme")) {
        setThemeState(getEffectiveTheme());
      }
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  function toggle() {
    setThemeState(toggleTheme());
  }

  return { theme, toggle };
}
