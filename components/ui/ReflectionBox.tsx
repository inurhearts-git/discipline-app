"use client";

import { useState } from "react";
import Link from "next/link";
import { PenLine } from "lucide-react";
import { COLORS, alpha } from "@/lib/constants";
import { REFLECTION_MAX } from "@/lib/reflection";

interface ReflectionBoxProps {
  initialText: string;
  contentId?: string | null; // the quote it's about, if any
  prompt?: string;
}

// Today's one-line reflection: a private note, one per day. Shows the saved
// line with an Edit button, or a small box to write one.
export function ReflectionBox({ initialText, contentId, prompt = "What will you carry from today?" }: ReflectionBoxProps) {
  const [saved, setSaved] = useState(initialText);
  const [draft, setDraft] = useState(initialText);
  const [editing, setEditing] = useState(!initialText);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/reflection", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, contentId: contentId ?? null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't save. Try again.");
      setSaved(data.text);
      setDraft(data.text);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/reflection", { method: "DELETE" });
      if (!res.ok) throw new Error();
      setSaved("");
      setDraft("");
      setEditing(true);
    } catch {
      setError("Couldn't delete. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const box = { width: "100%", textAlign: "left" as const, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: "14px 14px 12px", background: alpha(COLORS.brass, 4) };
  const header = (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 12, color: COLORS.slate }}>
      <PenLine size={13} color={COLORS.brass} aria-hidden /> {saved && !editing ? "Your line for today" : prompt}
    </div>
  );

  if (saved && !editing) {
    return (
      <div style={box}>
        {header}
        <p style={{ fontFamily: "'Newsreader', serif", fontStyle: "italic", fontSize: 17, lineHeight: 1.45, color: COLORS.parchment, margin: "0 0 10px" }}>{saved}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 12 }}>
          <button onClick={() => setEditing(true)} style={{ background: "none", border: "none", padding: 0, color: COLORS.brass, cursor: "pointer", fontSize: 12 }}>
            Edit
          </button>
          <Link href="/reflections" style={{ color: COLORS.slate, textDecoration: "none" }}>
            All reflections
          </Link>
          <span style={{ marginLeft: "auto", fontSize: 11, color: COLORS.slate }}>Only you can see this</span>
        </div>
      </div>
    );
  }

  const left = REFLECTION_MAX - draft.length;
  return (
    <div style={box}>
      {header}
      <textarea
        className="mf-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/\n/g, " ").slice(0, REFLECTION_MAX))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            save();
          }
        }}
        rows={2}
        maxLength={REFLECTION_MAX}
        placeholder="One line is enough."
        aria-label={prompt}
        style={{ resize: "none", marginBottom: 8, fontFamily: "'Newsreader', serif", fontStyle: "italic", fontSize: 16 }}
      />
      {error && <p style={{ color: COLORS.danger, fontSize: 12, margin: "0 0 8px" }}>{error}</p>}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={save}
          disabled={busy || !draft.trim()}
          style={{
            padding: "7px 14px",
            borderRadius: 8,
            border: "none",
            background: COLORS.brass,
            color: COLORS.onBrass,
            fontSize: 12,
            fontWeight: 600,
            cursor: busy || !draft.trim() ? "default" : "pointer",
            opacity: busy || !draft.trim() ? 0.5 : 1,
          }}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {saved && (
          <>
            <button
              onClick={() => {
                setDraft(saved);
                setEditing(false);
                setError("");
              }}
              style={{ background: "none", border: "none", padding: 0, color: COLORS.slate, cursor: "pointer", fontSize: 12 }}
            >
              Cancel
            </button>
            <button onClick={remove} disabled={busy} style={{ background: "none", border: "none", padding: 0, color: COLORS.slate, cursor: "pointer", fontSize: 12 }}>
              Delete
            </button>
          </>
        )}
        <span style={{ marginLeft: "auto", fontSize: 11, color: left < 30 ? COLORS.ember : COLORS.slate }}>{left}</span>
      </div>
    </div>
  );
}
