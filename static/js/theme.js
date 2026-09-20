/*
 * Theme toggle for GitCode.
 * Persists the choice in localStorage under "gc-theme".
 * Applied to <html data-theme="..."> before paint where possible.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "gc-theme";
  var root = document.documentElement;

  function apply(theme) {
    if (theme === "dark" || theme === "light") {
      root.setAttribute("data-theme", theme);
    } else {
      root.removeAttribute("data-theme");
    }
  }

  function current() {
    return localStorage.getItem(STORAGE_KEY) || "light";
  }

  function set(theme) {
    localStorage.setItem(STORAGE_KEY, theme);
    apply(theme);
  }

  // Initial: read from storage; default "light".
  apply(current());

  // Toggle button handler
  document.addEventListener("DOMContentLoaded", function () {
    var btn = document.getElementById("gc-theme-toggle");
    if (!btn) return;
    btn.addEventListener("click", function () {
      set(current() === "dark" ? "light" : "dark");
    });
  });
})();
