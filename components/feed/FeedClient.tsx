"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, Bookmark, Share2, Play, X, Clock, Eye, Volume2, VolumeX } from "lucide-react";
import { Shell, Logo } from "@/components/ui/Shell";
import { COLORS, DAILY_LIMIT_MS, HEARTBEAT_INTERVAL_MS, fmtClock, fmtCount, tagColor } from "@/lib/constants";
import type { ContentItem, Profile } from "@/lib/database.types";

export interface MusicTrack {
  id: string;
  title: string;
  artist: string | null;
  audio_url: string;
  mood_tags: string[] | null;
}

interface FeedClientProps {
  items: ContentItem[];
  profile: Profile;
  initialLiked: Record<string, boolean>;
  initialSaved: Record<string, boolean>;
  initialMsSpentToday: number;
  tracks: MusicTrack[];
}

// Never shorter than the old 720px; grows to fill taller phone screens.
const FEED_HEIGHT = "max(720px, min(calc(100dvh - 58px), 780px))";

function startTrack(a: HTMLAudioElement, track: MusicTrack) {
  if (a.dataset.url !== track.audio_url) {
    a.src = track.audio_url;
    a.dataset.url = track.audio_url;
  }
  return a.play();
}

const iconBtn = { background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 3 };

export function FeedClient({ items, profile, initialLiked, initialSaved, initialMsSpentToday, tracks }: FeedClientProps) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState<number | null>(null);
  const [liked, setLiked] = useState(initialLiked);
  const [saved, setSaved] = useState(initialSaved);
  const [msSpentToday, setMsSpentToday] = useState(initialMsSpentToday);
  const [viewCounts, setViewCounts] = useState<Record<string, number>>(
    Object.fromEntries(items.map((i) => [i.id, i.view_count]))
  );
  const [burstId, setBurstId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [unlocked, setUnlocked] = useState(false); // browsers only allow sound after a tap
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewedRef = useRef<Set<string>>(new Set());
  const lastTapRef = useRef<{ id: string; t: number } | null>(null);

  // Usage heartbeat (unchanged)
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
        if (data.msSpentToday >= data.limitMs) router.replace("/limit");
      } catch {
        // Network hiccup: next heartbeat will retry.
      }
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(tick);
  }, [router]);

  // View counter (unchanged)
  useEffect(() => {
    const item = items[index];
    if (!item || viewedRef.current.has(item.id)) return;
    viewedRef.current.add(item.id);
    fetch(`/api/content/${item.id}/view`, { method: "POST" })
      .then((res) => (res.ok ? res.json() : null))
      .then(() => {
        setViewCounts((prev) => ({ ...prev, [item.id]: (prev[item.id] ?? item.view_count) + 1 }));
      })
      .catch(() => {});
  }, [index, items]);

  // Track which tile is on screen
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const i = Math.round(el.scrollTop / el.clientHeight);
      setIndex(Math.max(0, Math.min(items.length - 1, i)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [items.length]);

  // Stop an embedded video when you scroll away from it
  useEffect(() => {
    setPlaying((p) => (p === index ? p : null));
  }, [index]);

  // ---- Background music ----
  useEffect(() => {
    try {
      setMuted(localStorage.getItem("mf-muted") === "1");
    } catch {
      // storage unavailable: keep default
    }
  }, []);

  // One shared audio element for the whole feed
  useEffect(() => {
    const a = new Audio();
    a.loop = true;
    a.volume = 0.35;
    audioRef.current = a;
    return () => {
      a.pause();
      audioRef.current = null;
    };
  }, []);

  // Shuffle: each new text tile gets a random track, never the same one twice in a row.
  // A tile keeps its track if you scroll back to it. Video tiles stay silent.
  const assignedRef = useRef<Record<string, string>>({});
  const lastTrackRef = useRef<string | null>(null);
  const [currentTrack, setCurrentTrack] = useState<MusicTrack | null>(null);

  useEffect(() => {
    const item = items[index];
    if (!item || item.type === "video" || tracks.length === 0) {
      setCurrentTrack(null);
      return;
    }
    let track: MusicTrack | undefined = item.audio_track_id
      ? tracks.find((t) => t.id === item.audio_track_id)
      : undefined;
    if (!track && assignedRef.current[item.id]) {
      track = tracks.find((t) => t.id === assignedRef.current[item.id]);
    }
    if (!track) {
      const matching = tracks.filter((t) => t.mood_tags?.includes(item.tag));
      const pool = matching.length ? matching : tracks;
      const choices = pool.length > 1 ? pool.filter((t) => t.id !== lastTrackRef.current) : pool;
      track = choices[Math.floor(Math.random() * choices.length)];
      assignedRef.current[item.id] = track.id;
    }
    lastTrackRef.current = track.id;
    setCurrentTrack(track);
  }, [index, items, tracks]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (!currentTrack || muted || !unlocked) {
      a.pause();
      return;
    }
    startTrack(a, currentTrack).catch(() => setUnlocked(false));
  }, [currentTrack, muted, unlocked]);

  const unlock = () => {
    setUnlocked(true);
    const a = audioRef.current;
    if (a && currentTrack && !muted) startTrack(a, currentTrack).catch(() => {});
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    try {
      localStorage.setItem("mf-muted", next ? "1" : "0");
    } catch {
      // ignore
    }
    if (!next) unlock();
  };

  const goTo = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(items.length - 1, i));
      const el = containerRef.current;
      if (el) el.scrollTo({ top: clamped * el.clientHeight, behavior: "smooth" });
    },
    [items.length]
  );

  // Arrow keys for desktop
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") goTo(index + 1);
      if (e.key === "ArrowUp") goTo(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, goTo]);

  const toggleInteraction = async (id: string, kind: "liked" | "saved") => {
    const setState = kind === "liked" ? setLiked : setSaved;
    setState((prev) => ({ ...prev, [id]: !prev[id] }));
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
      setState((prev) => ({ ...prev, [id]: !prev[id] }));
    }
  };

  // Double-tap a tile to like it
  const onTileTap = (item: ContentItem) => {
    if (!unlocked) unlock();
    const now = Date.now();
    const last = lastTapRef.current;
    if (last && last.id === item.id && now - last.t < 300) {
      lastTapRef.current = null;
      if (!liked[item.id]) toggleInteraction(item.id, "liked");
      setBurstId(item.id);
      setTimeout(() => setBurstId(null), 700);
    } else {
      lastTapRef.current = { id: item.id, t: now };
    }
  };

  const share = async (item: ContentItem) => {
    const url = `${window.location.origin}/feed?item=${item.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Discipline", text: item.text, url });
      } else {
        await navigator.clipboard.writeText(url);
        setToast("Link copied");
        setTimeout(() => setToast(null), 1800);
      }
    } catch {
      // Share sheet dismissed: nothing to do.
    }
  };

  const timeLeftMs = Math.max(0, DAILY_LIMIT_MS - msSpentToday);
  const avatarBg = profile.avatar_color ? `${profile.avatar_color}26` : "rgba(201,162,39,0.15)";
  const avatarFg = profile.avatar_color ?? COLORS.brass;

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
      <style>{`
        @keyframes mf-pop { 0% { transform: scale(0.4); opacity: 0; } 30% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(1); opacity: 0; } }
        .mf-pop { animation: mf-pop 0.7s ease-out forwards; }
      `}</style>

      {/* Slim transparent header */}
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
          padding: "14px 16px 24px",
          background: "linear-gradient(to bottom, rgba(20,17,15,0.7), rgba(20,17,15,0))",
          pointerEvents: "none",
        }}
      >
        <div style={{ pointerEvents: "auto" }}>
          <Logo />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, pointerEvents: "auto" }}>
          {tracks.length > 0 && (
            <button
              onClick={toggleMute}
              aria-label={muted ? "Unmute music" : "Mute music"}
              style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(20,17,15,0.55)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              {muted ? <VolumeX size={14} color={COLORS.slate} /> : <Volume2 size={14} color={COLORS.parchment} />}
            </button>
          )}
          <span
            style={{
              fontSize: 11,
              color: timeLeftMs < 5 * 60 * 1000 ? COLORS.ember : COLORS.parchment,
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 9px",
              borderRadius: 12,
              background: "rgba(20,17,15,0.55)",
            }}
          >
            <Clock size={12} /> {fmtClock(timeLeftMs)}
          </span>
          <button
            onClick={() => router.push("/profile")}
            aria-label="Profile"
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: avatarBg,
              border: "none",
              color: avatarFg,
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

      <div ref={containerRef} className="mf-scroll" style={{ height: FEED_HEIGHT, overflowY: "scroll", scrollSnapType: "y mandatory", position: "relative" }}>
        {items.map((item, i) => {
          const color = tagColor(item.tag);
          const isVideo = item.type === "video";
          return (
            <div
              key={item.id}
              onClick={() => onTileTap(item)}
              style={{
                height: "100%",
                scrollSnapAlign: "start",
                position: "relative",
                overflow: "hidden",
                background: isVideo
                  ? `linear-gradient(180deg, rgba(20,17,15,0.15) 0%, rgba(20,17,15,0.1) 40%, rgba(20,17,15,0.92) 100%), url(https://img.youtube.com/vi/${item.video_id}/hqdefault.jpg) center/cover no-repeat`
                  : `radial-gradient(circle at 30% 20%, ${COLORS.ink2} 0%, ${COLORS.ink} 70%)`,
              }}
            >
              {isVideo && playing !== i && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPlaying(i);
                  }}
                  aria-label="Play video"
                  style={{
                    position: "absolute",
                    top: "40%",
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

              {isVideo && playing === i && (
                <div style={{ position: "absolute", inset: 0, background: "#000", zIndex: 5 }}>
                  <iframe
                    title={item.attributed_to}
                    src={`https://www.youtube.com/embed/${item.video_id}?autoplay=1`}
                    style={{ width: "100%", height: "100%", border: "none" }}
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPlaying(null);
                    }}
                    aria-label="Close video"
                    style={{
                      position: "absolute",
                      top: 64,
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

              {burstId === item.id && (
                <div className="mf-pop" style={{ position: "absolute", top: "40%", left: "50%", marginLeft: -48, marginTop: -48, zIndex: 8, pointerEvents: "none" }}>
                  <Heart size={96} color={COLORS.ember} fill={COLORS.ember} />
                </div>
              )}

              {/* Caption, bottom-left */}
              <div style={{ position: "absolute", left: 0, right: 76, bottom: 0, padding: "0 16px 22px 18px", zIndex: 6, pointerEvents: playing === i ? "none" : "auto" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, color: COLORS.parchment, fontWeight: 600 }}>{item.attributed_to}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", border: `1px solid ${color}`, borderRadius: 3 }}>
                    <span style={{ width: 4, height: 4, borderRadius: "50%", background: color }} />
                    <span style={{ fontSize: 10, letterSpacing: 1.3, color, fontWeight: 500 }}>{item.tag}</span>
                  </span>
                </div>
                <p
                  style={{
                    fontFamily: "'Newsreader', serif",
                    fontStyle: "italic",
                    fontWeight: 400,
                    fontSize: item.text.length > 70 ? 21 : 26,
                    lineHeight: 1.35,
                    color: COLORS.parchment,
                    margin: "0 0 8px",
                    display: "-webkit-box",
                    WebkitLineClamp: 6,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {item.text}
                </p>
                {item.source && <span style={{ fontSize: 12, color: COLORS.slate }}>{item.source}</span>}
                {i === index && currentTrack && unlocked && !muted && (
                  <div style={{ marginTop: 8, fontSize: 11, color: COLORS.slate }}>
                    ♪ {currentTrack.title}
                    {currentTrack.artist ? ` · ${currentTrack.artist}` : ""}
                  </div>
                )}
              </div>

              {/* Action column, bottom-right */}
              <div style={{ position: "absolute", right: 10, bottom: 24, display: "flex", flexDirection: "column", gap: 18, alignItems: "center", zIndex: 7 }}>
                {item.person_id ? (
                  <Link
                    href={`/people/${item.person_id}`}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`More from ${item.attributed_to}`}
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: "50%",
                      background: "rgba(201,162,39,0.18)",
                      border: `1.5px solid ${COLORS.brass}`,
                      color: COLORS.brass,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "'Newsreader', serif",
                      fontStyle: "italic",
                      fontSize: 18,
                      textDecoration: "none",
                    }}
                  >
                    {item.attributed_to[0]?.toUpperCase()}
                  </Link>
                ) : null}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleInteraction(item.id, "liked");
                  }}
                  aria-label="Like"
                  style={iconBtn}
                >
                  <Heart size={28} color={liked[item.id] ? COLORS.ember : COLORS.parchment} fill={liked[item.id] ? COLORS.ember : "none"} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleInteraction(item.id, "saved");
                  }}
                  aria-label="Save"
                  style={iconBtn}
                >
                  <Bookmark size={26} color={saved[item.id] ? COLORS.brass : COLORS.parchment} fill={saved[item.id] ? COLORS.brass : "none"} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    share(item);
                  }}
                  aria-label="Share"
                  style={iconBtn}
                >
                  <Share2 size={24} color={COLORS.parchment} />
                </button>

                <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 2, fontSize: 11, color: COLORS.slate }}>
                  <Eye size={16} />
                  {fmtCount(viewCounts[item.id] ?? item.view_count)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {tracks.length > 0 && !unlocked && !muted && items[index]?.type !== "video" && (
        <button
          onClick={unlock}
          style={{ position: "absolute", top: 58, left: "50%", transform: "translateX(-50%)", zIndex: 25, padding: "6px 12px", borderRadius: 14, border: `1px solid ${COLORS.line}`, background: "rgba(20,17,15,0.8)", color: COLORS.parchment, fontSize: 12, cursor: "pointer" }}
        >
          ♪ Tap for sound
        </button>
      )}

      {toast && (
        <div
          style={{
            position: "absolute",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "8px 14px",
            borderRadius: 16,
            background: "rgba(20,17,15,0.9)",
            border: `1px solid ${COLORS.line}`,
            color: COLORS.parchment,
            fontSize: 12,
            zIndex: 30,
          }}
        >
          {toast}
        </div>
      )}
    </Shell>
  );
}
