import Link from "next/link";
import { Eye } from "lucide-react";
import { COLORS, fmtCount, tagColor } from "@/lib/constants";

export type Tag = Parameters<typeof tagColor>[0];

export interface CardItem {
  id: string;
  type: string;
  tag: Tag;
  text: string;
  attributed_to: string;
  video_id?: string | null;
  view_count: number;
}

export function ContentCard({ item, width = 150 }: { item: CardItem; width?: number | string }) {
  const bg =
    item.type === "video" && item.video_id
      ? `linear-gradient(180deg, rgba(20,17,15,0.1) 0%, rgba(20,17,15,0.9) 100%), url(https://img.youtube.com/vi/${item.video_id}/hqdefault.jpg) center/cover no-repeat`
      : `radial-gradient(circle at 30% 20%, ${COLORS.ink2} 0%, ${COLORS.ink} 80%)`;

  return (
    <Link
      href={`/feed?item=${item.id}`}
      style={{
        width,
        height: 210,
        flexShrink: 0,
        boxSizing: "border-box",
        borderRadius: 12,
        border: `1px solid ${COLORS.line}`,
        background: bg,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        textDecoration: "none",
        overflow: "hidden",
      }}
    >
      <span style={{ fontSize: 10, letterSpacing: 1.2, color: tagColor(item.tag), fontWeight: 500 }}>{item.tag}</span>
      <div>
        <p
          style={{
            fontFamily: "'Newsreader', serif",
            fontStyle: "italic",
            fontSize: 14,
            lineHeight: 1.3,
            color: COLORS.parchment,
            margin: "0 0 8px",
            display: "-webkit-box",
            WebkitLineClamp: 4,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {item.text}
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: COLORS.slate }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "65%" }}>
            {item.attributed_to}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            <Eye size={11} /> {fmtCount(item.view_count)}
          </span>
        </div>
      </div>
    </Link>
  );
}
