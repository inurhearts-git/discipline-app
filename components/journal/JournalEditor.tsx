"use client";

import { useEffect, useRef, useState } from "react";
import { COLORS, alpha } from "@/lib/constants";
import { JOURNAL_MAX_WORDS, countWords, fmtStamp, type JournalEntry } from "@/lib/journal";

interface JournalEditorProps {
  entry?: JournalEntry; // editing an existing entry; omit for a new one
  onSaved: (entry: JournalEntry) => void;
  onCancel: () => void;
}

// Writing area for a journal entry. Unsaved text is kept in this browser
// (localStorage) so a closed tab or a lost connection doesn't lose it.
export function JournalEditor({ entry, onSaved, onCancel }: JournalEditorProps) {
  const draftKey = entry ? `mf-journal-draft-${entry.id}` : "mf-journal-draft";
  const [body, setBody] = useState(entry?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState("");
  const [restored, setRestored] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  // Restore a draft, show the live time stamp for a new entry, focus the box.
  useEffect(() => {
    try {
      const d = localStorage.getItem(draftKey);
      if (d && d !== (entry?.body ?? "")) {
        setBody(d);
        setRestored(true);
      }
    } catch {
      /* storage blocked */
    }
    if (!entry) {
      const tick = () => setNow(fmtStamp(new Date().toISOString()));
      tick();
      const id = setInterval(tick, 30_000);
      ref.current?.focus();
      return () => clearInterval(id);
    }
    ref.current?.focus();
  }, [draftKey, entry]);

  // Grow the box with the text.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(320, el.scrollHeight)}px`;
  }, [body]);

  const update = (v: string) => {
    setBody(v);
    try {
      if (v.trim() && v !== (entry?.body ?? "")) localStorage.setItem(draftKey, v);
      else localStorage.removeItem(draftKey);
    } catch {
      /* storage blocked */
    }
  };

  const clearDraft = () => {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* storage blocked */
    }
  };

  const words = countWords(body);
  const over = words > JOURNAL_MAX_WORDS;
  const unchanged = !!entry && body.trim() === entry.body.trim();
  const canSave = !busy && !!body.trim() && !over && !unchanged;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(entry ? `/api/journal/${entry.id}` : "/api/journal", {
        method: entry ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't save. Try again.");
      clearDraft();
      onSaved(data as JournalEntry);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
      setBusy(false);
    }
  };

  const cancel = () => {
    if (body.trim() && !unchanged && !window.confirm("Discard what you've written?")) return;
    clearDraft();
    onCancel();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", color: COLORS.slate, marginBottom: 10, minHeight: 14 }}>
        {entry ? `Editing · written ${fmtStamp(entry.created_at)}` : now}
      </div>
      {restored && <p style={{ fontSize: 12, color: COLORS.brass, margin: "0 0 8px" }}>Restored your unsaved draft.</p>}

      <textarea
        ref={ref}
        value={body}
        onChange={(e) => update(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            save();
          }
        }}
        placeholder="What's on your mind today?"
        aria-label="Journal entry"
        style={{
          width: "100%",
          minHeight: 320,
          resize: "none",
          overflow: "hidden",
          border: `1px solid ${COLORS.line}`,
          borderRadius: 10,
          background: alpha(COLORS.parchment, 3),
          color: COLORS.parchment,
          padding: "14px 14px",
          fontFamily: "'Newsreader', serif",
          fontSize: 17,
          lineHeight: 1.6,
          outline: "none",
        }}
      />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "8px 2px 0", fontSize: 12 }}>
        <span style={{ color: over ? COLORS.danger : words > JOURNAL_MAX_WORDS * 0.9 ? COLORS.ember : COLORS.slate }}>
          {words.toLocaleString()} / {JOURNAL_MAX_WORDS.toLocaleString()} words
        </span>
        <span style={{ color: COLORS.slate }}>Only you can see this</span>
      </div>
      {over && <p style={{ color: COLORS.danger, fontSize: 12, margin: "6px 2px 0" }}>Trim {words - JOURNAL_MAX_WORDS} words to save.</p>}
      {error && <p style={{ color: COLORS.danger, fontSize: 12, margin: "6px 2px 0" }}>{error}</p>}

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button
          onClick={save}
          disabled={!canSave}
          style={{
            flex: 1,
            padding: "12px 14px",
            borderRadius: 10,
            border: "none",
            background: COLORS.brass,
            color: COLORS.onBrass,
            fontSize: 14,
            fontWeight: 600,
            cursor: canSave ? "pointer" : "default",
            opacity: canSave ? 1 : 0.5,
          }}
        >
          {busy ? "Saving…" : entry ? "Save changes" : "Save entry"}
        </button>
        <button
          onClick={cancel}
          disabled={busy}
          style={{ padding: "12px 16px", borderRadius: 10, border: `1px solid ${COLORS.line}`, background: "transparent", color: COLORS.parchment, fontSize: 14, cursor: "pointer" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
