"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bookmark, Play } from "lucide-react";
import { Shell } from "@/components/ui/Shell";
import { COLORS, tagColor } from "@/lib/constants";
import type { ContentItem } from "@/lib/database.types";

export type SavedItem = Pick<ContentItem, "id" | "type" | "tag" | "text" | "attributed_to" | "source">;

// The Saved list. Tapping an item opens it in the feed; the bookmark un-saves
// it (and can be tapped again to undo while the page is open).
export function SavedClient({ items }: { items: SavedItem[] }) {
  const [saved, setSaved] = useState<Record<string, boolean>>(() => Object.fromEntries(items.map((i) => [i.id, true])));

  const toggle = async (id: string) => {
    setSaved((prev) => ({ ...prev, [id]: !prev[id] }));
    try {
      const res = await fetch(`/api/content/${id}/interact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "saved" }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSaved((prev) => ({ ...prev, [id]: !!data.saved }));
    } catch {
      setSaved((prev) => ({ ...prev, [id]: !prev[id] }));
    }
  };

  const count = items.filter((i) => saved[i.id]).length;

  return (
    <Shell>
      <div style={{ padding: "18px 22px 28px", minHeight: 720 }}>
        <Link href="/profile" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: COLORS.slate, fontSize: 13, textDecoration: "none" }}>
          <ArrowLeft size={16} /> Profile
        </Link>
        <h1 style={{ fontFamily: "'Newsreader', serif", fontStyle: "italic", fontWeight: 400, fontSize: 26, color: COLORS.parchment, margin: "18px 0 4px" }}>Saved</h1>
        <p style={{ fontSize: 12, color: COLORS.slate, margin: "0 0 22px" }}>
          {count} {count === 1 ? "item" : "items"}
        </p>

        {items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 12px", color: COLORS.slate, fontSize: 13, lineHeight: 1.7 }}>
            <Bookmark size={22} color={COLORS.brass} style={{ marginBottom: 10 }} />
            <p style={{ margin: 0 }}>Nothing saved yet. Tap the bookmark on anything in the feed and it will be here.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {items.map((item) => {
              const on = saved[item.id];
              const color = tagColor(item.tag);
              return (
                <div
                  key={item.id}
                  style={{ display: "flex", gap: 10, alignItems: "flex-start", border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: "12px 10px 12px 14px", opacity: on ? 1 : 0.45 }}
                >
                  <Link href={`/feed?item=${item.id}`} style={{ flex: 1, minWidth: 0, textDecoration: "none" }}>
                    <p
                      style={{
                        fontFamily: "'Newsreader', serif",
                        fontStyle: "italic",
                        fontSize: 15,
                        lineHeight: 1.45,
                        color: COLORS.parchment,
                        margin: "0 0 6px",
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {item.type === "video" && <Play size={12} style={{ marginRight: 6, verticalAlign: "-1px" }} aria-label="Video" />}
                      {item.text}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: COLORS.slate }}>
                      <span>{item.attributed_to}</span>
                      <span style={{ fontSize: 9, letterSpacing: 1.2, color }}>{item.tag}</span>
                    </div>
                  </Link>
                  <button
                    onClick={() => toggle(item.id)}
                    aria-label={on ? "Remove from saved" : "Save again"}
                    aria-pressed={on}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 4, flexShrink: 0 }}
                  >
                    <Bookmark size={20} color={on ? COLORS.brass : COLORS.slate} fill={on ? COLORS.brass : "none"} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Shell>
  );
}
