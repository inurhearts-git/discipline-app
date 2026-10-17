"use client";

import { useEffect } from "react";

// Safety net: re-applies the saved theme once the app has mounted.
// If React ever has to rebuild the whole page on the client (hydration
// recovery), the attribute the startup script set on <html> is lost and the
// page falls back to the default dark palette. This puts it back.
export function ThemeSync() {
  useEffect(() => {
    try {
      const p = localStorage.getItem("mf-theme") || "dark";
      const t =
        p === "system"
          ? window.matchMedia("(prefers-color-scheme: light)").matches
            ? "light"
            : "dark"
          : p;
      document.documentElement.setAttribute("data-theme", t === "light" ? "light" : "dark");
    } catch {
      /* storage unavailable: leave the theme as is */
    }
  }, []);

  return null;
}
