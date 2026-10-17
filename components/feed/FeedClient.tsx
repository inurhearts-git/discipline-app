"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, Bookmark, Share2, Play, X, Clock, Eye, Volume2, VolumeX, Flame } from "lucide-react";
import { Shell, Logo } from "@/components/ui/Shell";
import { COLORS, DAILY_LIMIT_MS, HEARTBEAT_INTERVAL_MS, alpha, fmtClock, fmtCount, tagColor } from "@/lib/constants";
import type { ContentItem, Profile } from "@/lib/database.types";
import { STREAK_MIN_MS } from "@/lib/streak";
import { MOODS, type MoodId } from "@/lib/moods";

// Remember recently viewed items in a cookie so the server can rotate the feed
// on the next visit (read in app/feed/page.tsx).
const SEEN_MAX = 50;
function markSeen(id: string) {
  try {
    const m = document.cookie.match(/(?:^|; )mf_seen=([^;]*)/);
    const prev = m ? decodeURIComponent(m[1]).split(",").filter(Boolean) : [];
    const next = [...prev.filter((x) => x !== id), id].slice(-SEEN_MAX);
    document.cookie = `mf_seen=${encodeURIComponent(next.join(","))}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
  } catch {
    // Cookies blocked: the feed still works, it just won't rotate.
  }
}

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
  streakBase: number;
  activeMood: string | null;
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

export function FeedClient({ items, profile, initialLiked, initialSaved, initialMsSpentToday, tracks, streakBase, activeMood }: FeedClientProps) {
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

  // View counter + remember what was seen
  useEffect(() => {
    const item = items[index];
    if (!item || viewedRef.current.has(item.id)) return;
    viewedRef.current.add(item.id);
    markSeen(item.id);
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

  // Mood picker: shown once a day on open (not when arriving from Explore or a shared link)
  const [moodOpen, setMoodOpen] = useState(false);
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.has("item") || q.has("tag") || q.has("mood")) return;
      const day = new Date().toISOString().slice(0, 10);
      if (localStorage.getItem("mf-mood-day") !== day) setMoodOpen(true);
    } catch {
      // storage unavailable: skip the picker
    }
  }, []);
  const pickMood = (id: MoodId | null) => {
    try {
      localStorage.setItem("mf-mood-day", new Date().toISOString().slice(0, 10));
    } catch {
      // ignore
    }
    if (id) window.location.assign(`/feed?mood=${id}`);
    else setMoodOpen(false);
  };

  // Streak: consecutive days (ending yesterday) with 2+ minutes in the app, plus today once it counts
  const todayCounted = msSpentToday >= STREAK_MIN_MS;
  const streak = streakBase + (todayCounted ? 1 : 0);
  const startedCountedRef = useRef(initialMsSpentToday >= STREAK_MIN_MS);
  useEffect(() => {
    if (!todayCounted || startedCountedRef.current) return;
    startedCountedRef.current = true;
    setToast(`🔥 Day ${streak} streak`);
    setTimeout(() => setToast(null), 2500);
  }, [todayCounted, streak]);

  const timeLeftMs = Math.max(0, DAILY_LIMIT_MS - msSpentToday);
  const avatarFg = profile.avatar_color ?? "#C9A227";
  const avatarBg = alpha(avatarFg, 15);

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

  // Over a video tile the overlays stay in the dark palette so text is readable on the thumbnail.
  const onVideo = items[index]?.type === "video";

  return (
    <Shell>
      <style>{`
        @keyframes mf-pop { 0% { transform: scale(0.4); opacity: 0; } 30% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(1); opacity: 0; } }
        .mf-pop { animation: mf-pop 0.7s ease-out forwards; }
      `}</style>

      {/* Slim transparent header */}
      <div
        data-theme={onVideo ? "dark" : undefined}
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
          background: `linear-gradient(to bottom, ${alpha(COLORS.ink, 80)}, ${alpha(COLORS.ink, 0)})`,
          pointerEvents: "none",
        }}
      >
        <div style={{ pointerEvents: "auto" }}>
          <Logo />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, pointerEvents: "auto" }}>
          <span
            title={todayCounted ? "Streak counted for today" : "Spend 2 minutes here today to keep your streak"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              fontSize: 12,
              fontWeight: 600,
              padding: "4px 9px",
              borderRadius: 12,
              background: alpha(COLORS.ink, 55),
              color: todayCounted ? COLORS.ember : COLORS.slate,
            }}
          >
            <Flame size={13} fill={todayCounted ? COLORS.ember : "none"} /> {streak}
          </span>
          {tracks.length > 0 && (
            <button
              onClick={toggleMute}
              aria-label={muted ? "Unmute music" : "Mute music"}
              style={{ width: 28, height: 28, borderRadius: "50%", background: alpha(COLORS.ink, 55), border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
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
              background: alpha(COLORS.ink, 55),
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
          // Text tiles: the quote is the hero, centred, sized by length.
          const len = item.text.length;
          const quoteSize = isVideo ? (len > 70 ? 21 : 26) : len > 180 ? 22 : len > 110 ? 26 : len > 60 ? 30 : 34;
          return (
            <div
              key={item.id}
              data-theme={isVideo ? "dark" : undefined}
              onClick={() => onTileTap(item)}
              style={{
                height: "100%",
                scrollSnapAlign: "start",
                position: "relative",
                overflow: "hidden",
                background: isVideo
                  ? `linear-gradient(180deg, rgba(20,17,15,0.15) 0%, rgba(20,17,15,0.1) 40%, rgba(20,17,15,0.92) 100%), url(https://img.youtube.com/vi/${item.video_id}/hqdefault.jpg) center/cover no-repeat`
                  : `radial-gradient(circle at 25% 15%, ${alpha(COLORS.brass, 12)} 0%, transparent 55%), radial-gradient(circle at 30% 20%, ${COLORS.ink2} 0%, ${COLORS.ink} 70%)`,
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

              {/* Caption: bottom-left on video tiles, centred on text tiles */}
              <div
                style={
                  isVideo
                    ? { position: "absolute", left: 0, right: 76, bottom: 0, padding: "0 16px 22px 18px", zIndex: 6, pointerEvents: playing === i ? "none" : "auto" }
                    : { position: "absolute", top: 0, bottom: 0, left: 0, right: 64, padding: "76px 12px 36px 24px", display: "flex", flexDirection: "column", justifyContent: "center", zIndex: 6 }
                }
              >
                {!isVideo && (
                  <span aria-hidden style={{ order: 0, fontFamily: "'Newsreader', serif", fontSize: 72, lineHeight: 0.7, height: 34, color: COLORS.brass, opacity: 0.55 }}>
                    &ldquo;
                  </span>
                )}
                <div style={{ order: isVideo ? 0 : 2, display: "flex", alignItems: "center", gap: 8, marginBottom: isVideo ? 10 : 0, marginTop: isVideo ? 0 : 22, flexWrap: "wrap" }}>
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
                    order: 1,
                    fontSize: quoteSize,
                    lineHeight: 1.35,
                    color: COLORS.parchment,
                    margin: "0 0 8px",
                    display: "-webkit-box",
                    WebkitLineClamp: isVideo ? 6 : 10,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {item.text}
                </p>
                {item.source && <span style={{ order: 3, marginTop: isVideo ? 0 : 6, fontSize: 12, color: COLORS.slate }}>{item.source}</span>}
                {i === index && currentTrack && unlocked && !muted && (
                  <div style={{ order: 4, marginTop: isVideo ? 8 : 18, fontSize: 11, color: COLORS.slate }}>
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
                      background: alpha(COLORS.brass, 18),
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

      {/* Always reachable: shows the active mood, or a "Mood" chip when none is set */}
      <button
        onClick={() => setMoodOpen(true)}
        data-theme={onVideo ? "dark" : undefined}
        style={{ position: "absolute", top: 58, left: 16, zIndex: 20, padding: "5px 10px", borderRadius: 14, border: "none", background: alpha(COLORS.ink, 70), color: COLORS.parchment, fontSize: 11, cursor: "pointer" }}
      >
        {activeMood
          ? `${MOODS.find((m) => m.id === activeMood)?.emoji} ${MOODS.find((m) => m.id === activeMood)?.label} · change`
          : "💭 Mood"}
      </button>

      {moodOpen && (
        <div style={{ position: "absolute", inset: 0, zIndex: 40, background: alpha(COLORS.ink, 97), display: "flex", flexDirection: "column", justifyContent: "center", padding: 28 }}>
          <p style={{ fontFamily: "'Newsreader', serif", fontStyle: "italic", fontSize: 30, color: COLORS.parchment, margin: "0 0 6px" }}>How are you feeling?</p>
          <p style={{ fontSize: 13, color: COLORS.slate, margin: "0 0 22px" }}>We&apos;ll start your feed with what fits.</p>
          {MOODS.map((m) => (
            <button
              key={m.id}
              onClick={() => pickMood(m.id)}
              style={{ textAlign: "left", padding: "14px 16px", marginBottom: 10, borderRadius: 12, border: `1px solid ${COLORS.line}`, background: "var(--fill)", color: COLORS.parchment, fontSize: 15, cursor: "pointer" }}
            >
              <span style={{ marginRight: 10 }}>{m.emoji}</span>
              {m.label}
            </button>
          ))}
          <button
            onClick={() => pickMood(null)}
            style={{ marginTop: 6, background: "none", border: "none", color: COLORS.slate, fontSize: 13, cursor: "pointer" }}
          >
            Skip for now
          </button>
        </div>
      )}

      {tracks.length > 0 && !unlocked && !muted && items[index]?.type !== "video" && (
        <button
          onClick={unlock}
          data-theme={onVideo ? "dark" : undefined}
          style={{ position: "absolute", top: 58, left: "50%", transform: "translateX(-50%)", zIndex: 25, padding: "6px 12px", borderRadius: 14, border: `1px solid ${COLORS.line}`, background: alpha(COLORS.ink, 80), color: COLORS.parchment, fontSize: 12, cursor: "pointer" }}
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
            background: alpha(COLORS.ink, 90),
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
