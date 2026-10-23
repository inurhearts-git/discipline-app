"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, PlusCircle, User, Bell } from "lucide-react";
import { COLORS } from "@/lib/constants";

const TABS = [
  { href: "/feed", label: "Feed", Icon: Home },
  { href: "/explore", label: "Explore", Icon: Compass },
  { href: "/submit", label: "Submit", Icon: PlusCircle },
  { href: "/notifications", label: "Notices", Icon: Bell },
  { href: "/profile", label: "Profile", Icon: User },
];

// Only show the bar on the main app screens (not login, onboarding, limit, etc.)
const SHOW_ON = ["/feed", "/today", "/explore", "/people", "/submit", "/notifications", "/profile", "/saved", "/reflections", "/journal"];

// The bell asks for the unread count when a page opens, every minute while the
// tab is visible, and when the tab comes back into view. The Notifications
// page sends a "notices-changed" event (detail = new unread count) after
// marking things read, so the badge updates at once.
export const NOTICES_CHANGED = "notices-changed";
const POLL_MS = 60_000;

function deviceZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

function useUnreadCount(enabled: boolean, pathname: string): number {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const tz = deviceZone();
        const res = await fetch(`/api/notifications?count=1${tz ? `&tz=${encodeURIComponent(tz)}` : ""}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (alive && typeof data.unread === "number") setUnread(data.unread);
      } catch {
        // Offline: keep the last count.
      }
    };
    const onChanged = (e: Event) => {
      const n = (e as CustomEvent<number>).detail;
      if (typeof n === "number") setUnread(n);
      else load();
    };
    load();
    const timer = setInterval(load, POLL_MS);
    document.addEventListener("visibilitychange", load);
    window.addEventListener(NOTICES_CHANGED, onChanged);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
      window.removeEventListener(NOTICES_CHANGED, onChanged);
    };
  }, [enabled, pathname]);
  return unread;
}

export function BottomNav() {
  const pathname = usePathname() ?? "";
  const visible = SHOW_ON.some((p) => pathname.startsWith(p));
  const unread = useUnreadCount(visible, pathname);
  if (!visible) return null;

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
        const active =
          pathname.startsWith(href) ||
          (href === "/explore" && pathname.startsWith("/people")) ||
          (href === "/profile" && (["/saved", "/reflections", "/journal"].some((p) => pathname.startsWith(p))));
        const color = active ? COLORS.brass : COLORS.slate;
        const isBell = href === "/notifications";
        const badge = isBell && unread > 0 ? (unread > 9 ? "9+" : String(unread)) : null;
        return (
          <Link
            key={href}
            href={href}
            aria-label={isBell ? (unread > 0 ? `Notices, ${unread} unread` : "Notices") : undefined}
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
            <span style={{ position: "relative", display: "inline-flex" }}>
              <Icon size={20} color={color} />
              {badge && (
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    top: -5,
                    right: -9,
                    minWidth: 16,
                    height: 16,
                    padding: "0 4px",
                    boxSizing: "border-box",
                    borderRadius: 8,
                    background: COLORS.ember,
                    color: COLORS.onEmber,
                    fontSize: 10,
                    fontWeight: 600,
                    lineHeight: "16px",
                    textAlign: "center",
                    letterSpacing: 0,
                    boxShadow: `0 0 0 2px ${COLORS.ink}`,
                  }}
                >
                  {badge}
                </span>
              )}
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
