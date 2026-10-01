"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Search, Loader2 } from "lucide-react";
import { Shell } from "@/components/ui/Shell";
import { Btn } from "@/components/ui/Btn";
import { COLORS } from "@/lib/constants";
import type { ContentTag, ContentType, MaturityRating } from "@/lib/database.types";

interface YouTubeResult {
  videoId: string;
  title: string;
  channel: string;
  channelId: string;
  thumbnail: string;
  publishedAt: string;
}

export default function SubmitPage() {
  const router = useRouter();
  const [type, setType] = useState<ContentType>("quote");
  const [tag, setTag] = useState<ContentTag>("QUOTE");
  const [text, setText] = useState("");
  const [attributedTo, setAttributedTo] = useState("");
  const [source, setSource] = useState("");
  const [videoId, setVideoId] = useState("");
  const [maturityRating, setMaturityRating] = useState<MaturityRating>("general");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // --- YouTube search state (blueprint §4) ---
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [results, setResults] = useState<YouTubeResult[]>([]);
  const [selected, setSelected] = useState<YouTubeResult | null>(null);
  const [manualEntry, setManualEntry] = useState(false);

  const runSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError("");
    setResults([]);
    try {
      const res = await fetch(`/api/people/search?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setSearchError(data.error || "Search failed.");
        return;
      }
      setResults(data.results);
      if (data.results.length === 0) setSearchError("No videos found. Try a different name.");
    } catch {
      setSearchError("Search failed — check your connection and try again.");
    } finally {
      setSearching(false);
    }
  };

  const pickResult = (r: YouTubeResult) => {
    setSelected(r);
    setVideoId(r.videoId);
    setAttributedTo(r.channel);
    setSource(`${r.channel} · YouTube`);
    if (!text.trim()) setText(r.title);
  };

  const submit = async () => {
    setError("");
    if (!text.trim() || !attributedTo.trim()) {
      setError("Add both the text and who it's from.");
      return;
    }
    if (type === "video" && !videoId.trim()) {
      setError("Search for a video and select one, or enter a video ID manually.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        tag,
        text: text.trim(),
        attributed_to: attributedTo.trim(),
        source: source.trim() || undefined,
        video_id: videoId.trim() || undefined,
        person_name: type === "video" ? attributedTo.trim() : undefined,
        youtube_channel_id: selected?.channelId,
        maturity_rating: maturityRating,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Something went wrong.");
      return;
    }
    router.replace("/profile");
    router.refresh();
  };

  return (
    <Shell>
      <div style={{ padding: "24px 22px 28px", minHeight: 720, display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <button onClick={() => router.push("/profile")} aria-label="Back" style={{ background: "none", border: "none", color: COLORS.slate, cursor: "pointer", fontSize: 13 }}>
            ← Back
          </button>
          <span style={{ fontSize: 12, color: COLORS.slate }}>Submit for review</span>
        </div>
        <h2 style={{ fontFamily: "'Newsreader', serif", fontStyle: "italic", fontSize: 22, color: COLORS.parchment, margin: "0 0 18px" }}>
          Add something to the feed
        </h2>

        <label className="mf-label">Type</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {(
            [
              { k: "quote" as ContentType, l: "Quote", tag: "QUOTE" as ContentTag },
              { k: "scripture" as ContentType, l: "Scripture", tag: "SCRIPTURE" as ContentTag },
              { k: "video" as ContentType, l: "Speech clip", tag: "SPEECH" as ContentTag },
            ]
          ).map((o) => (
            <button
              key={o.k}
              onClick={() => {
                setType(o.k);
                setTag(o.tag);
                setError("");
              }}
              style={{
                flex: 1,
                padding: "8px 6px",
                borderRadius: 8,
                fontSize: 12,
                border: `1px solid ${type === o.k ? COLORS.brass : COLORS.line}`,
                background: type === o.k ? "rgba(201,162,39,0.08)" : "transparent",
                color: COLORS.parchment,
                cursor: "pointer",
              }}
            >
              {o.l}
            </button>
          ))}
        </div>

        {type === "video" && !manualEntry && (
          <div style={{ marginBottom: 16 }}>
            <label className="mf-label">Find a speaker&apos;s videos</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input
                className="mf-input"
                style={{ marginBottom: 0 }}
                placeholder="e.g. David Goggins"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
              />
              <button
                onClick={runSearch}
                disabled={searching || !searchQuery.trim()}
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
                aria-label="Search"
              >
                {searching ? <Loader2 size={16} className="mf-spin" /> : <Search size={16} />}
              </button>
            </div>

            {searchError && <p style={{ color: COLORS.danger, fontSize: 12, margin: "0 0 10px" }}>{searchError}</p>}

            {results.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto", marginBottom: 10 }}>
                {results.map((r) => (
                  <button
                    key={r.videoId}
                    onClick={() => pickResult(r)}
                    style={{
                      display: "flex",
                      gap: 10,
                      textAlign: "left",
                      padding: 8,
                      borderRadius: 8,
                      border: `1px solid ${selected?.videoId === r.videoId ? COLORS.brass : COLORS.line}`,
                      background: selected?.videoId === r.videoId ? "rgba(201,162,39,0.08)" : "transparent",
                      cursor: "pointer",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.thumbnail} alt="" width={72} height={54} style={{ borderRadius: 4, objectFit: "cover", flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: COLORS.parchment, fontSize: 12, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                        {r.title}
                      </div>
                      <div style={{ color: COLORS.slate, fontSize: 11, marginTop: 2 }}>{r.channel}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selected && (
              <p style={{ color: COLORS.sage, fontSize: 12, margin: "0 0 10px" }}>
                Selected: {selected.title}
              </p>
            )}

            <button
              onClick={() => setManualEntry(true)}
              style={{ background: "none", border: "none", color: COLORS.slate, fontSize: 11, textDecoration: "underline", cursor: "pointer", padding: 0 }}
            >
              Or enter a video ID manually
            </button>
          </div>
        )}

        {type === "video" && manualEntry && (
          <>
            <label className="mf-label">YouTube video ID</label>
            <input className="mf-input" placeholder="e.g. UF8uR6Z6KLc" value={videoId} onChange={(e) => setVideoId(e.target.value)} />
            <button
              onClick={() => setManualEntry(false)}
              style={{ background: "none", border: "none", color: COLORS.slate, fontSize: 11, textDecoration: "underline", cursor: "pointer", padding: 0, marginBottom: 14 }}
            >
              Search YouTube instead
            </button>
          </>
        )}

        <label className="mf-label">Text{type === "video" ? " (caption shown over the clip)" : ""}</label>
        <textarea
          className="mf-input"
          rows={3}
          placeholder="The line itself"
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ resize: "vertical" }}
        />
        <label className="mf-label">Attributed to</label>
        <input className="mf-input" placeholder="e.g. Seneca" value={attributedTo} onChange={(e) => setAttributedTo(e.target.value)} />
        <label className="mf-label">Source (optional)</label>
        <input className="mf-input" placeholder="e.g. Letters from a Stoic" value={source} onChange={(e) => setSource(e.target.value)} />

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
              onClick={() => setMaturityRating(o.k)}
              style={{
                flex: 1,
                padding: "8px 6px",
                borderRadius: 8,
                fontSize: 12,
                border: `1px solid ${maturityRating === o.k ? (o.k === "mature" ? COLORS.ember : COLORS.brass) : COLORS.line}`,
                background: maturityRating === o.k ? (o.k === "mature" ? "rgba(194,84,46,0.1)" : "rgba(201,162,39,0.08)") : "transparent",
                color: COLORS.parchment,
                cursor: "pointer",
              }}
            >
              {o.l}
            </button>
          ))}
        </div>
        <p style={{ color: COLORS.slate, fontSize: 11, margin: "-6px 0 14px" }}>
          An admin can adjust this at review time. Mature content is hidden from anyone who hasn&apos;t confirmed they&apos;re 18+.
        </p>

        {error && <p style={{ color: COLORS.danger, fontSize: 12, margin: "0 0 12px" }}>{error}</p>}
        <div style={{ flex: 1 }} />
        <Btn variant="primary" disabled={submitting} onClick={submit} style={{ justifyContent: "center", padding: "13px 16px" }}>
          <Send size={15} /> {submitting ? "Submitting…" : "Submit for approval"}
        </Btn>
        <p style={{ color: COLORS.slate, fontSize: 11, marginTop: 10, textAlign: "center" }}>
          An admin reviews every submission before it appears in the feed.
        </p>
      </div>
    </Shell>
  );
}
