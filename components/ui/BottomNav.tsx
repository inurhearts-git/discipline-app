"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, PlusCircle, User } from "lucide-react";
import { COLORS } from "@/lib/constants";

const TABS = [
  { href: "/feed", label: "Feed", Icon: Home },
  { href: "/explore", label: "Explore", Icon: Compass },
  { href: "/submit", label: "Submit", Icon: PlusCircle },
  { href: "/profile", label: "Profile", Icon: User },
];

// Only show the bar on the main app screens (not login, onboarding, limit, etc.)
const SHOW_ON = ["/feed", "/explore", "/people", "/submit", "/profile"];

export function BottomNav() {
  const pathname = usePathname() ?? "";
  if (!SHOW_ON.some((p) => pathname.startsWith(p))) return null;

  return (
    <nav
      style={{
        display: "flex",
        height: 58,
        borderTop: `1px solid ${COLORS.line}`,
        background: COLORS.ink,
        position: "relative",
        zIndex: 30,
      }}
    >
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname.startsWith(href) || (href === "/explore" && pathname.startsWith("/people"));
        const color = active ? COLORS.brass : COLORS.slate;
        return (
          <Link
            key={href}
            href={href}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              color,
              textDecoration: "none",
              fontSize: 10,
              letterSpacing: 0.8,
            }}
          >
            <Icon size={20} color={color} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
