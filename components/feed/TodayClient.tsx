"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bookmark, Heart, Share2, Sun } from "lucide-react";
import { Shell } from "@/components/ui/Shell";
import { ResetCountdown } from "@/components/ui/ResetCountdown";
import { ReflectionBox } from "@/components/ui/ReflectionBox";
import { ShareSheet } from "@/components/ui/ShareSheet";
import { ListenButton } from "@/components/ui/ListenButton";
import { MeaningLink, MeaningSheet } from "@/components/ui/MeaningSheet";
import { useSpeech } from "@/lib/useSpeech";
import { COLORS, alpha, tagColor } from "@/lib/constants";
import type { ContentItem } from "@/lib/database.types";

interface TodayClientProps {
  item: ContentItem | null;
  initialLiked: boolean;
  initialSaved: boolean;
  initialReflection: string;
  hasMeaning?: boolean;
}

const iconBtn = { background: "none", border: "none", cursor: "pointer", padding: 6, display: "flex", alignItems: "center" };

export function TodayClient({ item, initialLiked, initialSaved, initialReflection, hasMeaning = false }: TodayClientProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [saved, setSaved] = useState(initialSaved);
  const [toast, setToast] = useState<string | null>(null);
  const [meaningOpen, setMeaningOpen] = useState(false);
  const { supported: canSpeak, speakingId, speak } = useSpeech();

  // Clears the dot on the feed's sun button for the rest of the UTC day.
  useEffect(() => {
    try {
      localStorage.setItem("mf-qotd-day", new Date().toISOString().slice(0, 10));
    } catch {
      /* storage blocked: the dot just stays */
    }
  }, []);

  const toggle = async (kind: "liked" | "saved") => {
    if (!item) return;
    const set = kind === "liked" ? setLiked : setSaved;
    set((v) => !v);
    try {
      const res = await fetch(`/api/content/${item.id}/interact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      set(!!data[kind]);
    } catch {
      set((v) => !v);
    }
  };

  const [sharing, setSharing] = useState(false);
  const share = () => item && setSharing(true);

  const len = item?.text.length ?? 0;
  const size = len > 220 ? 22 : len > 140 ? 26 : len > 70 ? 30 : 36;
  const color = item ? tagColor(item.tag) : COLORS.brass;

  return (
    <Shell>
      <div style={{ minHeight: 720, display: "flex", flexDirection: "column", padding: "18px 22px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/feed" aria-label="Back to feed" style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.slate, fontSize: 13, textDecoration: "none" }}>
            <ArrowLeft size={16} /> Feed
          </Link>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: COLORS.brass }}>
            <Sun size={14} aria-hidden /> Quote of the day
          </span>
        </div>

        {item ? (
          <>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "24px 4px" }}>
              <span aria-hidden style={{ fontFamily: "'Newsreader', serif", fontSize: 80, lineHeight: 0.7, height: 38, color: COLORS.brass, opacity: 0.55 }}>
                &ldquo;
              </span>
              <p style={{ fontFamily: "'Newsreader', serif", fontStyle: "italic", fontSize: size, lineHeight: 1.35, color: COLORS.parchment, margin: "0 0 22px" }}>
                {item.text}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {item.person_id ? (
                  <Link href={`/people/${item.person_id}`} style={{ fontSize: 14, color: COLORS.parchment, fontWeight: 600, textDecoration: "none" }}>
                    {item.attributed_to}
                  </Link>
                ) : (
                  <span style={{ fontSize: 14, color: COLORS.parchment, fontWeight: 600 }}>{item.attributed_to}</span>
                )}
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", border: `1px solid ${color}`, borderRadius: 3 }}>
                  <span style={{ width: 4, height: 4, borderRadius: "50%", background: color }} />
                  <span style={{ fontSize: 10, letterSpacing: 1.3, color, fontWeight: 500 }}>{item.tag}</span>
                </span>
              </div>
              {item.source && <span style={{ marginTop: 8, fontSize: 12, color: COLORS.slate }}>{item.source}</span>}
              {hasMeaning && <MeaningLink onOpen={() => setMeaningOpen(true)} />}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 28, padding: "12px 0 18px" }}>
              <button onClick={() => toggle("liked")} aria-label="Like" aria-pressed={liked} style={iconBtn}>
                <Heart size={28} color={liked ? COLORS.ember : COLORS.parchment} fill={liked ? COLORS.ember : "none"} />
              </button>
              <button onClick={() => toggle("saved")} aria-label="Save" aria-pressed={saved} style={iconBtn}>
                <Bookmark size={26} color={saved ? COLORS.brass : COLORS.parchment} fill={saved ? COLORS.brass : "none"} />
              </button>
              <button onClick={share} aria-label="Share" style={iconBtn}>
                <Share2 size={24} color={COLORS.parchment} />
              </button>
              {canSpeak && <ListenButton active={speakingId === item.id} onClick={() => speak(item.id, item.text, item.attributed_to)} style={iconBtn} />}
            </div>

            <div style={{ marginBottom: 16 }}>
              <ReflectionBox initialText={initialReflection} contentId={item.id} prompt="What does this say to you today?" />
            </div>

            <div style={{ textAlign: "center", fontSize: 12, color: COLORS.slate, borderTop: `1px solid ${COLORS.line}`, paddingTop: 14 }}>
              A new one in <ResetCountdown />
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", color: COLORS.slate, fontSize: 13 }}>
            No quote of the day yet. Add some quotes or scripture first.
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position: "absolute", bottom: 80, left: "50%", transform: "translateX(-50%)", padding: "8px 14px", borderRadius: 14, background: alpha(COLORS.ink, 90), border: `1px solid ${COLORS.line}`, color: COLORS.parchment, fontSize: 12, zIndex: 30 }}>
          {toast}
        </div>
      )}
      {meaningOpen && item && <MeaningSheet contentId={item.id} onClose={() => setMeaningOpen(false)} />}
      {sharing && item && (
        <ShareSheet
          item={item}
          onClose={() => setSharing(false)}
          onToast={(msg) => {
            setToast(msg);
            setTimeout(() => setToast(null), 1800);
          }}
        />
      )}
    </Shell>
  );
}
