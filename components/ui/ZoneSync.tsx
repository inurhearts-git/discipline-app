"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TZ_COOKIE } from "@/lib/day";

// Tells the server the device's time zone (cookie), so "today" for the daily
// hour, streaks and reflections runs midnight to midnight where the person is.
// If the zone was missing or changed (travel), the page is re-rendered once.
export function ZoneSync() {
  const router = useRouter();
  useEffect(() => {
    let tz = "";
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch {
      return;
    }
    if (!tz) return;
    const m = document.cookie.match(new RegExp(`(?:^|; )${TZ_COOKIE}=([^;]*)`));
    const current = m ? decodeURIComponent(m[1]) : null;
    if (current === tz) return;
    document.cookie = `${TZ_COOKIE}=${encodeURIComponent(tz)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    router.refresh();
  }, [router]);
  return null;
}
