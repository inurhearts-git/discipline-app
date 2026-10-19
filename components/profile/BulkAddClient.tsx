"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Plus } from "lucide-react";
import { Shell } from "@/components/ui/Shell";
import { Btn } from "@/components/ui/Btn";
import { COLORS, alpha } from "@/lib/constants";
import { MOODS, type MoodId } from "@/lib/moods";
import type { MaturityRating } from "@/lib/database.types";

interface YouTubeResult {
  videoId: string;
  title: string;
  channel: string;
  channelId: string;
  thumbnail: string;
  publishedAt: string;
  durationSec: number;
}

// YouTube titles can arrive HTML-encoded (&amp;, &#39;); clean them for captions.
const decodeEntities = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

export function BulkAddClient() {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [speaker, setSpeaker] = useState("");
  const [speakerEdited, setSpeakerEdited] = useState(false);

  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [results, setResults] = useState<YouTubeResult[]>([]);
  // Fresh searches left today (null until the first search, or if the counter isn't set up).
  const [searchesLeft, setSearchesLeft] = useState<number | null>(null);

  // videoId -> caption (editable). Only ticked videos are in here.
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [addedTotal, setAddedTotal] = useState(0);

  const [moods, setMoods] = useState<MoodId[]>([]);
  const [maturity, setMaturity] = useState<MaturityRating>("general");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Show the searches-left counter as soon as the page opens.
  useEffect(() => {
    fetch("/api/people/search?status=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.searchesLeft === "number") setSearchesLeft(d.searchesLeft);
      })
      .catch(() => {});
  }, []);

  const pickedIds = Object.keys(picked);

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError("");
    setMessage("");
    setResults([]);
    setPicked({});
    if (!speakerEdited) setSpeaker(q);
    try {
      const res = await fetch(`/api/people/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (typeof data.searchesLeft === "number") setSearchesLeft(data.searchesLeft);
      if (!res.ok) {
        setSearchError(data.error || "Search failed.");
        return;
      }
      setResults(data.results);
      if (data.results.length === 0) setSearchError("No clips of 30 seconds to 2 minutes found. Try a different name.");
    } catch {
      setSearchError("Search failed. Check your connection and try again.");
    } finally {
      setSearching(false);
    }
  };

  const toggle = (r: YouTubeResult) => {
    if (added.has(r.videoId)) return;
    setPicked((prev) => {
      const next = { ...prev };
      if (r.videoId in next) delete next[r.videoId];
      else next[r.videoId] = decodeEntities(r.title);
      return next;
    });
  };

  const selectAll = () => {
    const next: Record<string, string> = {};
    for (const r of results) {
      if (added.has(r.videoId)) continue;
      next[r.videoId] = picked[r.videoId] ?? decodeEntities(r.title);
    }
    setPicked(next);
  };

  const toggleMood = (id: MoodId) =>
    setMoods((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));

  const submit = async () => {
    setError("");
    setMessage("");
    if (!speaker.trim()) {
      setError("Add the speaker's name.");
      return;
    }
    if (pickedIds.length === 0) {
      setError("Tick at least one video.");
      return;
    }
    if (pickedIds.some((id) => !picked[id].trim())) {
      setError("Every ticked video needs a caption.");
      return;
    }
    const channelId = results.find((r) => r.videoId === pickedIds[0])?.channelId;

    setSaving(true);
    try {
      const res = await fetch("/api/admin/bulk-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          speaker: speaker.trim(),
          channel_id: channelId,
          maturity_rating: maturity,
          moods,
          items: pickedIds.map((id) => ({ video_id: id, text: picked[id].trim() })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      setAdded((prev) => new Set([...Array.from(prev), ...pickedIds]));
      setAddedTotal((n) => n + (data.added ?? 0));
      setPicked({});
      setSpeakerEdited(false);
      setMessage(
        data.skipped
          ? `Added ${data.added} to the feed. ${data.skipped} already in the feed, so skipped.`
          : `Added ${data.added} to the feed.`
      );
      router.refresh();
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Shell>
      <div style={{ padding: "24px 22px 28px", minHeight: 720, display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <button
            onClick={() => router.push("/moderate")}
            aria-label="Back to moderation"
            style={{ background: "none", border: "none", color: COLORS.slate, cursor: "pointer", fontSize: 13 }}
          >
            ← Back
          </button>
          <span style={{ fontSize: 12, color: COLORS.slate }}>{addedTotal} added this visit</span>
        </div>

        <h2 style={{ fontFamily: "'Newsreader', serif", fontStyle: "italic", fontSize: 22, color: COLORS.parchment, margin: "0 0 6px" }}>
          Add speech clips in bulk
        </h2>
        <p style={{ color: COLORS.slate, fontSize: 12, margin: "0 0 18px" }}>
          Search a speaker, tick the clips you want, and they go straight into the feed.
        </p>

        <label className="mf-label" htmlFor="bulk-search">Search YouTube</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input
            id="bulk-search"
            className="mf-input"
            style={{ marginBottom: 0 }}
            placeholder="e.g. David Goggins"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
          />
          <button
            onClick={runSearch}
            disabled={searching || !query.trim()}
            aria-label="Search"
            style={{
              flexShrink: 0,
              width: 42,
              borderRadius: 8,
              border: `1px solid ${COLORS.line}`,
              background: "transparent",
              color: COLORS.parchment,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {searching ? <Loader2 size={16} className="mf-spin" /> : <Search size={16} />}
          </button>
        </div>

        <label className="mf-label" htmlFor="bulk-speaker">Speaker name (shown on every clip)</label>
        <input
          id="bulk-speaker"
          className="mf-input"
          placeholder="e.g. David Goggins"
          value={speaker}
          onChange={(e) => {
            setSpeaker(e.target.value);
            setSpeakerEdited(true);
          }}
        />

        {searchesLeft !== null && (
          <p style={{ color: searchesLeft <= 5 ? COLORS.danger : COLORS.slate, fontSize: 11, margin: "0 0 10px" }}>
            {searchesLeft} new {searchesLeft === 1 ? "search" : "searches"} left today. Repeat searches from the last 24 hours are free. Only clips of 30 seconds to 2 minutes are shown.
          </p>
        )}

        {searchError && <p style={{ color: COLORS.danger, fontSize: 12, margin: "0 0 10px" }}>{searchError}</p>}

        {results.length > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "4px 0 8px" }}>
              <span style={{ fontSize: 12, color: COLORS.slate }}>{pickedIds.length} ticked</span>
              <span style={{ display: "flex", gap: 14 }}>
                <button onClick={selectAll} style={linkBtn}>Tick all</button>
                <button onClick={() => setPicked({})} style={linkBtn}>Clear</button>
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {results.map((r) => {
                const on = r.videoId in picked;
                const done = added.has(r.videoId);
                return (
                  <div
                    key={r.videoId}
                    style={{
                      padding: 8,
                      borderRadius: 8,
                      border: `1px solid ${on ? COLORS.brass : COLORS.line}`,
                      background: on ? alpha(COLORS.brass, 8) : "transparent",
                      opacity: done ? 0.5 : 1,
                    }}
                  >
                    <button
                      onClick={() => toggle(r)}
                      disabled={done}
                      aria-pressed={on}
                      style={{
                        display: "flex",
                        gap: 10,
                        width: "100%",
                        textAlign: "left",
                        padding: 0,
                        border: "none",
                        background: "none",
                        cursor: done ? "default" : "pointer",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={r.thumbnail} alt="" width={72} height={54} style={{ borderRadius: 4, objectFit: "cover", flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: COLORS.parchment, fontSize: 12, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                          {decodeEntities(r.title)}
                        </div>
                        <div style={{ color: COLORS.slate, fontSize: 11, marginTop: 2 }}>
                          {done ? "Added to the feed" : on ? `${r.channel}: ticked` : r.channel}{r.durationSec ? ` · ${Math.floor(r.durationSec / 60)}:${String(r.durationSec % 60).padStart(2, "0")}` : ""}
                        </div>
                      </div>
                    </button>

                    {on && (
                      <input
                        className="mf-input"
                        aria-label="Caption shown over the clip"
                        style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}
                        value={picked[r.videoId]}
                        maxLength={300}
                        onChange={(e) => setPicked((prev) => ({ ...prev, [r.videoId]: e.target.value }))}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <label className="mf-label">Who is this for? (applies to every ticked clip)</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {MOODS.map((m) => {
            const on = moods.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggleMood(m.id)}
                aria-pressed={on}
                style={{
                  padding: "7px 12px",
                  borderRadius: 999,
                  fontSize: 12,
                  border: `1px solid ${on ? COLORS.brass : COLORS.line}`,
                  background: on ? alpha(COLORS.brass, 8) : "transparent",
                  color: COLORS.parchment,
                  cursor: "pointer",
                }}
              >
                {m.emoji} {m.label}
              </button>
            );
          })}
        </div>

        <label className="mf-label">Maturity rating</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {(
            [
              { k: "general" as MaturityRating, l: "General" },
              { k: "mature" as MaturityRating, l: "Mature" },
            ]
          ).map((o) => (
            <button
              key={o.k}
              onClick={() => setMaturity(o.k)}
              style={{
                flex: 1,
                padding: "8px 6px",
                borderRadius: 8,
                fontSize: 12,
                border: `1px solid ${maturity === o.k ? (o.k === "mature" ? COLORS.ember : COLORS.brass) : COLORS.line}`,
                background:
                  maturity === o.k ? (o.k === "mature" ? alpha(COLORS.ember, 10) : alpha(COLORS.brass, 8)) : "transparent",
                color: COLORS.parchment,
                cursor: "pointer",
              }}
            >
              {o.l}
            </button>
          ))}
        </div>

        {error && <p style={{ color: COLORS.danger, fontSize: 12, margin: "0 0 12px" }}>{error}</p>}
        {message && <p style={{ color: COLORS.sage, fontSize: 12, margin: "0 0 12px" }}>{message}</p>}

        <div style={{ flex: 1 }} />
        <Btn variant="primary" disabled={saving || pickedIds.length === 0} onClick={submit} style={{ justifyContent: "center", padding: "13px 16px" }}>
          <Plus size={15} /> {saving ? "Adding…" : pickedIds.length > 0 ? `Add ${pickedIds.length} to the feed` : "Add to the feed"}
        </Btn>
        <p style={{ color: COLORS.slate, fontSize: 11, marginTop: 10, textAlign: "center" }}>
          Clips are approved straight away. Check the speaker, mood and rating before you add.
        </p>
      </div>
    </Shell>
  );
}

const linkBtn: CSSProperties = {
  background: "none",
  border: "none",
  color: COLORS.slate,
  fontSize: 12,
  textDecoration: "underline",
  cursor: "pointer",
  padding: 0,
};
