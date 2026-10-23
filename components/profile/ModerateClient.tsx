"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2, Plus, Lightbulb, RefreshCw, Play } from "lucide-react";
import { Shell } from "@/components/ui/Shell";
import { Btn } from "@/components/ui/Btn";
import { COLORS, alpha, tagColor } from "@/lib/constants";
import { MOODS, isMoodId, type MoodId } from "@/lib/moods";
import type { ContentItem, MaturityRating } from "@/lib/database.types";

// `moods` is selected by app/moderate/page.tsx; read it without depending on
// the ContentItem type having been updated.
const moodsOf = (item: ContentItem): MoodId[] =>
  ((item as ContentItem & { moods?: string[] | null }).moods ?? []).filter(isMoodId);

export function ModerateClient({ initialPending }: { initialPending: ContentItem[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(initialPending);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  // Blueprint §6: "content_items.maturity_rating set by whoever submits,
  // reviewed and confirmable by admin at approval time." Tracks any
  // in-review overrides before the admin clicks Approve.
  const [ratings, setRatings] = useState<Record<string, MaturityRating>>(
    Object.fromEntries(initialPending.map((p) => [p.id, p.maturity_rating]))
  );
  // Same idea for moods: starts as the submitter's picks, the admin can change
  // them before approving.
  const [moodsById, setMoodsById] = useState<Record<string, MoodId[]>>(
    Object.fromEntries(initialPending.map((p) => [p.id, moodsOf(p)]))
  );

  // Editable captions for video clips (a raw YouTube title is often untidy).
  const [texts, setTexts] = useState<Record<string, string>>(Object.fromEntries(initialPending.map((p) => [p.id, p.text])));
  // Rejecting asks for an optional reason, shown to the creator in their notice.
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const isAuto = (item: ContentItem) => (item as ContentItem & { auto_added?: boolean }).auto_added === true;

  const toggleMood = (itemId: string, mood: MoodId) =>
    setMoodsById((prev) => {
      const current = prev[itemId] ?? [];
      return {
        ...prev,
        [itemId]: current.includes(mood) ? current.filter((m) => m !== mood) : [...current, mood],
      };
    });

  const act = async (item: ContentItem, action: "approve" | "reject") => {
    setBusyId(item.id);
    setError("");
    try {
      const res = await fetch(`/api/moderate/${item.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          maturity_rating: action === "approve" ? ratings[item.id] : undefined,
          moods: action === "approve" ? moodsById[item.id] ?? [] : undefined,
          text: action === "approve" && item.type === "video" ? texts[item.id] : undefined,
          reason: action === "reject" ? (reasons[item.id] ?? "").trim() || undefined : undefined,
        }),
      });
      if (res.ok) {
        setPending((prev) => prev.filter((p) => p.id !== item.id));
        setRejectingId(null);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Couldn't update that item. Try again.");
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Shell>
      <div style={{ padding: "24px 22px 28px", minHeight: 720, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <button onClick={() => router.push("/profile")} aria-label="Back" style={{ background: "none", border: "none", color: COLORS.slate, cursor: "pointer", fontSize: 13 }}>
            ← Back
          </button>
          <span style={{ fontSize: 12, color: COLORS.slate }}>{pending.length} pending</span>
        </div>
        <h2 style={{ fontFamily: "'Newsreader', serif", fontStyle: "italic", fontSize: 22, color: COLORS.parchment, margin: "0 0 12px" }}>
          Review submissions
        </h2>

        <button
          onClick={() => router.push("/moderate/bulk")}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "9px 10px",
            marginBottom: 18,
            borderRadius: 8,
            fontSize: 12,
            border: `1px solid ${COLORS.line}`,
            background: "transparent",
            color: COLORS.parchment,
            cursor: "pointer",
          }}
        >
          <Plus size={14} /> Add speech clips in bulk
        </button>
        <button
          onClick={() => router.push("/moderate/meanings")}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "9px 10px",
            margin: "-10px 0 18px",
            borderRadius: 8,
            fontSize: 12,
            border: `1px solid ${COLORS.line}`,
            background: "transparent",
            color: COLORS.parchment,
            cursor: "pointer",
          }}
        >
          <Lightbulb size={14} /> Review meanings
        </button>

        <button
          onClick={() => router.push("/moderate/refill")}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "9px 10px",
            margin: "-10px 0 18px",
            borderRadius: 8,
            fontSize: 12,
            border: `1px solid ${COLORS.line}`,
            background: "transparent",
            color: COLORS.parchment,
            cursor: "pointer",
          }}
        >
          <RefreshCw size={14} /> Auto refill
        </button>

        {error && <p style={{ color: COLORS.danger, fontSize: 12, margin: "0 0 12px" }}>{error}</p>}
        {pending.length === 0 && <p style={{ color: COLORS.slate, fontSize: 13, textAlign: "center", marginTop: 60 }}>Nothing waiting on you.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
          {pending.map((item) => (
            <div key={item.id} style={{ border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 14 }}>
              <span style={{ fontSize: 10, letterSpacing: 1, color: tagColor(item.tag) }}>{item.tag}</span>
              {isAuto(item) && (
                <span style={{ marginLeft: 8, fontSize: 10, padding: "1px 6px", borderRadius: 4, border: `1px solid ${COLORS.line}`, color: COLORS.slate }}>Auto-added</span>
              )}
              {item.type === "video" && item.video_id ? (
                <>
                  <a
                    href={`https://www.youtube.com/watch?v=${item.video_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Watch this clip on YouTube (opens a new tab)"
                    style={{ position: "relative", display: "block", margin: "8px 0", borderRadius: 8, overflow: "hidden", lineHeight: 0 }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`https://img.youtube.com/vi/${item.video_id}/mqdefault.jpg`} alt="" width={320} height={180} style={{ width: "100%", height: "auto", display: "block" }} />
                    <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.25)" }}>
                      <Play size={28} color="#fff" fill="#fff" aria-hidden />
                    </span>
                  </a>
                  <input
                    className="mf-input"
                    aria-label="Caption"
                    value={texts[item.id] ?? item.text}
                    maxLength={300}
                    onChange={(e) => setTexts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    style={{ marginBottom: 8 }}
                  />
                </>
              ) : (
                <p style={{ fontFamily: "'Newsreader', serif", fontStyle: "italic", color: COLORS.parchment, fontSize: 15, margin: "6px 0" }}>{item.text}</p>
              )}
              <p style={{ fontSize: 12, color: COLORS.slate, margin: "0 0 4px" }}>
                {item.attributed_to}
                {item.source ? ` · ${item.source}` : ""}
              </p>
              <p style={{ fontSize: 11, color: COLORS.slate, margin: "0 0 10px" }}>
                Submitted by {item.submitted_by_profile?.display_name ?? "unknown"}
              </p>

              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {(["general", "mature"] as MaturityRating[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRatings((prev) => ({ ...prev, [item.id]: r }))}
                    style={{
                      flex: 1,
                      padding: "6px 4px",
                      borderRadius: 6,
                      fontSize: 11,
                      textTransform: "capitalize",
                      border: `1px solid ${ratings[item.id] === r ? (r === "mature" ? COLORS.ember : COLORS.brass) : COLORS.line}`,
                      background:
                        ratings[item.id] === r
                          ? r === "mature"
                            ? alpha(COLORS.ember, 12)
                            : alpha(COLORS.brass, 10)
                          : "transparent",
                      color: COLORS.parchment,
                      cursor: "pointer",
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>

              <p style={{ fontSize: 11, color: COLORS.slate, margin: "0 0 6px" }}>Who is this for?</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {MOODS.map((m) => {
                  const on = (moodsById[item.id] ?? []).includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMood(item.id, m.id)}
                      aria-pressed={on}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 999,
                        fontSize: 11,
                        border: `1px solid ${on ? COLORS.brass : COLORS.line}`,
                        background: on ? alpha(COLORS.brass, 10) : "transparent",
                        color: COLORS.parchment,
                        cursor: "pointer",
                      }}
                    >
                      {m.emoji} {m.label}
                    </button>
                  );
                })}
              </div>

              {rejectingId === item.id ? (
                <div>
                  <label className="mf-label" htmlFor={`reason-${item.id}`}>
                    Reason for the creator (optional)
                  </label>
                  <textarea
                    id={`reason-${item.id}`}
                    className="mf-input"
                    rows={2}
                    maxLength={200}
                    placeholder="For example: the source couldn't be checked"
                    value={reasons[item.id] ?? ""}
                    onChange={(e) => setReasons((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    style={{ resize: "vertical", marginBottom: 8 }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <Btn variant="danger" disabled={busyId === item.id} onClick={() => act(item, "reject")} style={{ flex: 1, justifyContent: "center", padding: "8px" }}>
                      <Trash2 size={14} /> Reject
                    </Btn>
                    <Btn variant="ghost" disabled={busyId === item.id} onClick={() => setRejectingId(null)} style={{ flex: 1, justifyContent: "center", padding: "8px" }}>
                      Cancel
                    </Btn>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn variant="primary" disabled={busyId === item.id} onClick={() => act(item, "approve")} style={{ flex: 1, justifyContent: "center", padding: "8px" }}>
                    <Check size={14} /> Approve
                  </Btn>
                  <Btn variant="danger" disabled={busyId === item.id} onClick={() => setRejectingId(item.id)} style={{ flex: 1, justifyContent: "center", padding: "8px" }}>
                    <Trash2 size={14} /> Reject
                  </Btn>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}
