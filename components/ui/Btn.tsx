"use client";

import { COLORS } from "@/lib/constants";
import type { ButtonHTMLAttributes, CSSProperties } from "react";

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger";
}

export function Btn({ children, variant = "ghost", disabled, style, ...rest }: BtnProps) {
  const base: CSSProperties = {
    padding: "10px 16px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.4 : 1,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontFamily: "'Space Grotesk', sans-serif",
    letterSpacing: 0.2,
  };
  const variants: Record<string, CSSProperties> = {
    primary: { background: COLORS.brass, color: COLORS.ink, border: `1px solid ${COLORS.brass}` },
    ghost: { background: "transparent", color: COLORS.parchment, border: `1px solid ${COLORS.line}` },
    danger: { background: "transparent", color: COLORS.danger, border: `1px solid ${COLORS.danger}` },
  };
  return (
    <button disabled={disabled} style={{ ...base, ...variants[variant], ...style }} {...rest}>
      {children}
    </button>
  );
}
