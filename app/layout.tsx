import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ThemeSync } from "@/components/ui/ThemeSync";
import { ZoneSync } from "@/components/ui/ZoneSync";

export const metadata: Metadata = {
  title: "Discipline",
  description: "A feed built for focus, not scrolling.",
  // Home-screen app (app/manifest.ts); iPhone needs it for push notifications.
  appleWebApp: { capable: true, title: "Discipline", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#14110f" };

// Runs before first paint so there is no flash of the wrong theme.
// Preference is "dark" | "light" | "system" in localStorage `mf-theme`.
// To make new visitors follow their device instead, change the "dark"
// default below to "system" (and the same default in ThemeToggle.tsx).
const themeScript = `(function(){var d=document.documentElement;try{var p=localStorage.getItem("mf-theme")||"dark";var t=p==="system"?(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):p;d.setAttribute("data-theme",t==="light"?"light":"dark");}catch(e){d.setAttribute("data-theme","dark");}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeSync />
        <ZoneSync />
        {children}
      </body>
    </html>
  );
}
