"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Bookmark, Share2, ChevronUp, ChevronDown, Play, X, Clock } from "lucide-react";
import { Shell, Logo } from "@/components/ui/Shell";
import { COLORS, DAILY_LIMIT_MS, HEARTBEAT_INTERVAL_MS, fmtClock, tagColor } from "@/lib/constants";
import type { ContentItem, Profile } from "@/lib/database.types";

interface FeedClientProps {
  items: ContentItem[];
  profile: Profile;
  initialLiked: Record<string, boolean>;
  initialSaved: Record<string, boolean>;
  initialMsSpentToday: number;
}

export function FeedClient({ items, profile, initialLiked, initialSaved, initialMsSpentToday }: FeedClientProps) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState<number | null>(null);
  const [liked, setLiked] = useState(initialLiked);
  const [saved, setSaved] = useState(initialSaved);
  const [msSpentToday, setMsSpentToday] = useState(initialMsSpentToday);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Server-authoritative heartbeat (blueprint §5). The interval only sends
  // a fixed delta — it never trusts or sends any locally-accumulated
  // "time spent" number, so there's nothing here for a client to tamper
  // with beyond how often it calls the endpoint, which the server also
  // clamps per-call.
  useEffect(() => {
    const tick = setInterval(async () => {
      try {
        const res = await fetch("/api/usage/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deltaMs: HEARTBEAT_INTERVAL_MS }),
        });
        if (!res.ok) return;
        const data = await res.json();
        setMsSpentToday(data.msSpentToday);
        if (data.msSpentToday >= data.limitMs) {
          router.replace("/limit");
        }
      } catch {
        // Network hiccup — next heartbeat will retry. We deliberately don't
        // advance any local timer in the meantime.
      }
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(tick);
  }, [router]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const h = el.clientHeight;
      const i = Math.round(el.scrollTop / h);
      setIndex(Math.max(0, Math.min(items.length - 1, i)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [items.length]);

  const goTo = (i: number) => {
    const clamped = Math.max(0, Math.min(items.length - 1, i));
    const el = containerRef.current;
    if (el) el.scrollTo({ top: clamped * el.clientHeight, behavior: "smooth" });
    setPlaying(null);
  };

  const toggleInteraction = async (id: string, kind: "liked" | "saved") => {
    const setState = kind === "liked" ? setLiked : setSaved;
    setState((prev) => ({ ...prev, [id]: !prev[id] })); // optimistic
    try {
      const res = await fetch(`/api/content/${id}/interact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setState((prev) => ({ ...prev, [id]: data[kind] }));
    } catch {
      setState((prev) => ({ ...prev, [id]: !prev[id] })); // revert
    }
  };

  const timeLeftMs = Math.max(0, DAILY_LIMIT_MS - msSpentToday);

  if (items.length === 0) {
    return (
      <Shell>
        <div style={{ padding: 28, minHeight: 720, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <p style={{ color: COLORS.slate, fontSize: 13 }}>No content matches your current preferences yet.</p>
          <button
            onClick={() => router.push("/profile")}
            style={{ marginTop: 16, padding: "10px 16px", borderRadius: 8, border: `1px solid ${COLORS.line}`, background: "transparent", color: COLORS.parchment, cursor: "pointer" }}
          >
            Edit preferences
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 20px 14px",
          background: "linear-gradient(to bottom, rgba(20,17,15,0.85), rgba(20,17,15,0))",
        }}
      >
        <Logo />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 11, color: timeLeftMs < 5 * 60 * 1000 ? COLORS.ember : COLORS.slate, display: "flex", alignItems: "center", gap: 4 }}>
            <Clock size={12} /> {fmtClock(timeLeftMs)}
          </span>
          <span style={{ fontSize: 11, color: COLORS.slate, letterSpacing: 1.5 }}>
            {String(index + 1).padStart(2, "0")}/{String(items.length).padStart(2, "0")}
          </span>
          <button
            onClick={() => router.push("/profile")}
            aria-label="Profile"
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "rgba(201,162,39,0.15)",
              border: "none",
              color: COLORS.brass,
              fontFamily: "'Newsreader', serif",
              fontStyle: "italic",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {profile.display_name[0].toUpperCase()}
          </button>
        </div>
      </div>

      <div ref={containerRef} className="mf-scroll" style={{ height: 720, overflowY: "scroll", scrollSnapType: "y mandatory", position: "relative" }}>
        {items.map((item, i) => (
          <div
            key={item.id}
            style={{
              height: 720,
              scrollSnapAlign: "start",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              padding: "0 24px 100px",
              background:
                item.type === "video"
                  ? `linear-gradient(180deg, rgba(20,17,15,0.2) 0%, rgba(20,17,15,0.75) 65%, ${COLORS.ink} 100%), url(https://img.youtube.com/vi/${item.video_id}/hqdefault.jpg) center/cover no-repeat`
                  : `radial-gradient(circle at 30% 20%, ${COLORS.ink2} 0%, ${COLORS.ink} 70%)`,
            }}
          >
            <div style={{ position: "absolute", top: 74, left: 24, display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", border: `1px solid ${tagColor(item.tag)}`, borderRadius: 3, width: "fit-content" }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: tagColor(item.tag) }} />
              <span style={{ fontSize: 11, letterSpacing: 1.5, color: tagColor(item.tag), fontWeight: 500 }}>{item.tag}</span>
            </div>

            {item.type === "video" && playing !== i && (
              <button
                onClick={() => setPlaying(i)}
                aria-label="Play video"
                style={{
                  position: "absolute",
                  top: "38%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  border: `1.5px solid ${COLORS.parchment}`,
                  background: "rgba(20,17,15,0.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <Play color={COLORS.parchment} size={24} fill={COLORS.parchment} style={{ marginLeft: 3 }} />
              </button>
            )}
            {item.type === "video" && playing === i && (
              <div style={{ position: "absolute", inset: 0, background: "#000", zIndex: 5 }}>
                <iframe
                  title={item.attributed_to}
                  src={`https://www.youtube.com/embed/${item.video_id}?autoplay=1`}
                  style={{ width: "100%", height: "100%", border: "none" }}
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
                <button
                  onClick={() => setPlaying(null)}
                  aria-label="Close video"
                  style={{
                    position: "absolute",
                    top: 14,
                    right: 14,
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "rgba(20,17,15,0.7)",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <X color={COLORS.parchment} size={16} />
                </button>
              </div>
            )}

            <div style={{ position: "relative", zIndex: 2 }}>
              <p
                style={{
                  fontFamily: "'Newsreader', serif",
                  fontStyle: "italic",
                  fontWeight: 400,
                  fontSize: item.text.length > 70 ? 24 : 30,
                  lineHeight: 1.35,
                  color: COLORS.parchment,
                  margin: "0 0 16px",
                }}
              >
                {item.text}
              </p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <div style={{ width: 22, height: 1, background: tagColor(item.tag) }} />
                <span style={{ fontSize: 14, color: COLORS.parchment, fontWeight: 500 }}>{item.attributed_to}</span>
              </div>
              {item.source && <span style={{ fontSize: 12, color: COLORS.slate, marginLeft: 30 }}>{item.source}</span>}
            </div>

            <div style={{ position: "absolute", right: 16, bottom: 110, display: "flex", flexDirection: "column", gap: 20, alignItems: "center", zIndex: 3 }}>
              <button onClick={() => toggleInteraction(item.id, "liked")} aria-label="Like" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                <Heart size={26} color={liked[item.id] ? COLORS.ember : COLORS.parchment} fill={liked[item.id] ? COLORS.ember : "none"} />
              </button>
              <button onClick={() => toggleInteraction(item.id, "saved")} aria-label="Save" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                <Bookmark size={24} color={saved[item.id] ? COLORS.brass : COLORS.parchment} fill={saved[item.id] ? COLORS.brass : "none"} />
              </button>
              <button aria-label="Share" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                <Share2 size={22} color={COLORS.parchment} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ position: "absolute", right: 4, top: 90, bottom: 100, display: "flex", flexDirection: "column", justifyContent: "space-between", zIndex: 15, pointerEvents: "none" }}>
        {items.map((_, i) => (
          <div key={i} style={{ width: i === index ? 14 : 8, height: 2, background: i === index ? COLORS.brass : COLORS.line, transition: "all 0.2s ease" }} />
        ))}
      </div>

      <div style={{ position: "absolute", bottom: 20, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 14, zIndex: 20 }}>
        <button
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          aria-label="Previous"
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: `1px solid ${COLORS.line}`,
            background: "rgba(20,17,15,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: index === 0 ? "default" : "pointer",
            opacity: index === 0 ? 0.35 : 1,
          }}
        >
          <ChevronUp size={18} color={COLORS.parchment} />
        </button>
        <button
          onClick={() => goTo(index + 1)}
          disabled={index === items.length - 1}
          aria-label="Next"
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: `1px solid ${COLORS.brass}`,
            background: COLORS.brass,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: index === items.length - 1 ? "default" : "pointer",
            opacity: index === items.length - 1 ? 0.35 : 1,
          }}
        >
          <ChevronDown size={18} color={COLORS.ink} />
        </button>
      </div>
    </Shell>
  );
}
