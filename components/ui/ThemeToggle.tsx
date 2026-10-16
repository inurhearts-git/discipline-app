"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { COLORS } from "@/lib/constants";

type Pref = "dark" | "light" | "system";

const STORAGE_KEY = "mf-theme";
const DEFAULT_PREF: Pref = "dark";

const OPTIONS: { key: Pref; label: string; Icon: typeof Sun }[] = [
  { key: "light", label: "Light", Icon: Sun },
  { key: "dark", label: "Dark", Icon: Moon },
  { key: "system", label: "System", Icon: Monitor },
];

const resolve = (pref: Pref): "light" | "dark" => {
  if (pref === "system") {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return pref;
};

const apply = (pref: Pref) => {
  document.documentElement.setAttribute("data-theme", resolve(pref));
};

export function ThemeToggle() {
  const [pref, setPref] = useState<Pref>(DEFAULT_PREF);

  // Read the saved choice after mount (avoids a hydration mismatch).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Pref | null;
      if (saved === "light" || saved === "dark" || saved === "system") setPref(saved);
    } catch {
      /* storage unavailable: keep default */
    }
  }, []);

  // When on "System", follow the device if it switches while the app is open.
  useEffect(() => {
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  const choose = (next: Pref) => {
    setPref(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    apply(next);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      style={{ display: "flex", gap: 6 }}
    >
      {OPTIONS.map(({ key, label, Icon }) => {
        const active = pref === key;
        return (
          <button
            key={key}
            role="radio"
            aria-checked={active}
            onClick={() => choose(key)}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "8px 6px",
              borderRadius: 8,
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "'Space Grotesk', sans-serif",
              border: `1px solid ${active ? COLORS.brass : COLORS.line}`,
              background: active ? COLORS.brass : "transparent",
              color: active ? COLORS.onBrass : COLORS.parchment,
            }}
          >
            <Icon size={13} /> {label}
          </button>
        );
      })}
    </div>
  );
}
