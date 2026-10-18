"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { Shell } from "@/components/ui/Shell";
import { Stamp } from "@/components/journal/Stamp";
import { JournalEditor } from "@/components/journal/JournalEditor";
import { COLORS } from "@/lib/constants";
import { countWords, wasEdited, type JournalEntry } from "@/lib/journal";

export function EntryClient({ entry: initial }: { entry: JournalEntry }) {
  const router = useRouter();
  const [entry, setEntry] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const remove = async () => {
    if (!window.confirm("Delete this entry? This can't be undone.")) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/journal/${entry.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.push("/journal");
      router.refresh();
    } catch {
      setError("Couldn't delete. Try again.");
      setDeleting(false);
    }
  };

  const action = { display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, fontSize: 13, cursor: "pointer" };

  return (
    <Shell>
      <div style={{ padding: "18px 22px 28px", minHeight: 720 }}>
        <Link href="/journal" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: COLORS.slate, fontSize: 13, textDecoration: "none" }}>
          <ArrowLeft size={16} /> Journal
        </Link>

        <div style={{ marginTop: 18 }}>
          {editing ? (
            <JournalEditor
              entry={entry}
              onSaved={(saved) => {
                setEntry(saved);
                setEditing(false);
                router.refresh();
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <>
              <div style={{ fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", color: COLORS.slate }}>
                <Stamp iso={entry.created_at} />
              </div>
              <div style={{ fontSize: 11, color: COLORS.slate, marginTop: 4, minHeight: 14 }}>
                {countWords(entry.body)} words
                {wasEdited(entry) && (
                  <>
                    {" · "}
                    <Stamp iso={entry.updated_at} prefix="edited " />
                  </>
                )}
              </div>

              <p
                style={{
                  fontFamily: "'Newsreader', serif",
                  fontSize: 18,
                  lineHeight: 1.65,
                  color: COLORS.parchment,
                  margin: "22px 0 28px",
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                }}
              >
                {entry.body}
              </p>

              <div style={{ display: "flex", gap: 22, borderTop: `1px solid ${COLORS.line}`, paddingTop: 14 }}>
                <button onClick={() => setEditing(true)} style={{ ...action, color: COLORS.brass }}>
                  <Pencil size={15} /> Edit
                </button>
                <button onClick={remove} disabled={deleting} style={{ ...action, color: COLORS.slate }}>
                  <Trash2 size={15} /> {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
              {error && <p style={{ color: COLORS.danger, fontSize: 12, margin: "10px 0 0" }}>{error}</p>}
            </>
          )}
        </div>
      </div>
    </Shell>
  );
}
