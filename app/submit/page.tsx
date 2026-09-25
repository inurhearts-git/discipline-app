"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Shell } from "@/components/ui/Shell";
import { Btn } from "@/components/ui/Btn";
import { COLORS } from "@/lib/constants";
import type { ContentTag, ContentType } from "@/lib/database.types";

export default function SubmitPage() {
  const router = useRouter();
  const [type, setType] = useState<ContentType>("quote");
  const [tag, setTag] = useState<ContentTag>("QUOTE");
  const [text, setText] = useState("");
  const [attributedTo, setAttributedTo] = useState("");
  const [source, setSource] = useState("");
  const [videoId, setVideoId] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setError("");
    if (!text.trim() || !attributedTo.trim()) {
      setError("Add both the text and who it's from.");
      return;
    }
    if (type === "video" && !videoId.trim()) {
      setError("Add a YouTube video ID for a speech clip.");
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
      <div style={{ padding: "24px 22px 28px", minHeight: 720, display: "flex", flexDirection: "column" }}>
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

        <label className="mf-label">Text</label>
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
        {type === "video" && (
          <>
            <label className="mf-label">YouTube video ID</label>
            <input className="mf-input" placeholder="e.g. UF8uR6Z6KLc" value={videoId} onChange={(e) => setVideoId(e.target.value)} />
          </>
        )}
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
