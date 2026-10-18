"use client";

import { useEffect, useState } from "react";
import { fmtStamp } from "@/lib/journal";

// Date and time in the viewer's own time zone. Empty until mounted, so the
// server (which runs in UTC) and the browser always render the same HTML.
export function Stamp({ iso, prefix = "" }: { iso: string; prefix?: string }) {
  const [text, setText] = useState("");
  useEffect(() => setText(fmtStamp(iso)), [iso]);
  return <span suppressHydrationWarning>{text ? `${prefix}${text}` : " "}</span>;
}
