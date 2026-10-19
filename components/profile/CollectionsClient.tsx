"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shell } from "@/components/ui/Shell";
import { COLORS, alpha } from "@/lib/constants";
import { MOODS } from "@/lib/moods";
import { COLLECTION_TAGS, type Collection } from "@/lib/collections";

interface Draft {
  id: string | null;
  title: string;
  blurb: string;
  emoji: string;
  tags: string[];
  moods: string[];
  sort_order: number;
  is_active: boolean;
}

const blank = (order: number): Draft => ({ id: null, title: "", blurb: "", emoji: "📚", tags: [], moods: [], sort_order: order, is_active: true });

export function CollectionsClient({ initial, counts, missingTable }: { initial: Collection[]; counts: Record<string, number>; missingTable: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const small = { fontSize: 12, color: COLORS.slate, margin: 0 } as const;
  const input = { width: "100%", boxSizing: "border-box" as const, padding: "9px 11px", borderRadius: 8, border: `1px solid ${COLORS.line}`, background: "var(--fill)", color: COLORS.parchment, fontSize: 14 };

  const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const chip = (on: boolean) => ({
    padding: "6px 11px",
    borderRadius: 999,
    fontSize: 12,
    cursor: "pointer",
    border: `1px solid ${on ? COLORS.brass : COLORS.line}`,
    background: on ? alpha(COLORS.brass, 14) : "none",
    color: on ? COLORS.brass : COLORS.parchment,
  });

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/collections", {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error || "That didn't save. Try again.");
        return;
      }
      setDraft(null);
      router.refresh();
    } catch {
      setError("That didn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: Collection) => {
    if (!window.confirm(`Delete "${c.title}"? The items stay in the app; only the collection goes.`)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/collections", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id }) });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "That didn't delete. Try again.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <div style={{ padding: "24px 22px 32px" }}>
        <Link href="/profile" style={{ color: COLORS.slate, fontSize: 13, textDecoration: "none" }}>
          ← Profile
        </Link>
        <h1 style={{ fontFamily: "'Newsreader', serif", fontStyle: "italic", fontWeight: 400, fontSize: 28, color: COLORS.parchment, margin: "16px 0 6px" }}>Collections</h1>
        <p style={{ ...small, lineHeight: 1.6, margin: "0 0 16px" }}>
          A collection fills itself: every approved clip or quote that matches its topics <em>and</em> moods appears in it. Add a new item and it shows up on its own. People find collections at the top of Explore.
        </p>

        {missingTable && <p role="alert" style={{ color: COLORS.danger, fontSize: 12, margin: "0 0 12px" }}>The collections table isn&apos;t there yet. Run migration 0014 in Supabase first.</p>}
        {error && <p role="alert" style={{ color: COLORS.danger, fontSize: 12, margin: "0 0 12px" }}>{error}</p>}

        {!draft && (
          <button
            onClick={() => setDraft(blank((initial[initial.length - 1]?.sort_order ?? 0) + 1))}
            disabled={missingTable}
            style={{ width: "100%", padding: "11px 14px", borderRadius: 8, border: "none", background: COLORS.brass, color: COLORS.onBrass, fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: missingTable ? 0.45 : 1, marginBottom: 16 }}
          >
            New collection
          </button>
        )}

        {draft && (
          <div style={{ border: `1px solid ${alpha(COLORS.brass, 45)}`, background: alpha(COLORS.brass, 6), borderRadius: 10, padding: 14, marginBottom: 18 }}>
            <p style={{ margin: "0 0 10px", fontSize: 14, color: COLORS.parchment, fontWeight: 500 }}>{draft.id ? "Edit collection" : "New collection"}</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input aria-label="Emoji" value={draft.emoji} maxLength={8} onChange={(e) => setDraft({ ...draft, emoji: e.target.value })} style={{ ...input, width: 64, textAlign: "center" }} />
              <input aria-label="Title" placeholder="Title" value={draft.title} maxLength={60} onChange={(e) => setDraft({ ...draft, title: e.target.value })} style={input} />
            </div>
            <input aria-label="Blurb" placeholder="One line about it (optional)" value={draft.blurb} maxLength={160} onChange={(e) => setDraft({ ...draft, blurb: e.target.value })} style={{ ...input, marginBottom: 12 }} />

            <p style={{ ...small, marginBottom: 6 }}>Topics (leave empty for all)</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {COLLECTION_TAGS.map((t) => (
                <button key={t} type="button" onClick={() => setDraft({ ...draft, tags: toggleIn(draft.tags, t) })} style={chip(draft.tags.includes(t))}>
                  {t}
                </button>
              ))}
            </div>

            <p style={{ ...small, marginBottom: 6 }}>Moods (leave empty for all)</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {MOODS.map((m) => (
                <button key={m.id} type="button" onClick={() => setDraft({ ...draft, moods: toggleIn(draft.moods, m.id) })} style={chip(draft.moods.includes(m.id))}>
                  {m.emoji} {m.label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
              <label style={{ ...small, display: "flex", alignItems: "center", gap: 6 }}>
                Order
                <input type="number" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} style={{ ...input, width: 64, padding: "6px 8px" }} />
              </label>
              <label style={{ ...small, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} />
                Shown on Explore
              </label>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={save} disabled={busy} style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "none", background: COLORS.brass, color: COLORS.onBrass, fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: busy ? 0.5 : 1 }}>
                {busy ? "Saving…" : "Save"}
              </button>
              <button onClick={() => { setDraft(null); setError(""); }} disabled={busy} style={{ padding: "10px 14px", borderRadius: 8, border: `1px solid ${COLORS.line}`, background: "none", color: COLORS.parchment, fontSize: 13, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {initial.length === 0 && !missingTable && <p style={small}>No collections yet.</p>}
        {initial.map((c) => (
          <div key={c.id} style={{ border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 12, marginBottom: 10, opacity: c.is_active ? 1 : 0.55 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}>{c.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: COLORS.parchment, fontSize: 14, fontWeight: 500 }}>{c.title}{!c.is_active && <span style={{ ...small, marginLeft: 8 }}>hidden</span>}</div>
                <p style={small}>
                  {counts[c.id] ?? 0} item{(counts[c.id] ?? 0) === 1 ? "" : "s"} · {c.tags.length ? c.tags.join(", ") : "all topics"} · {c.moods.length ? c.moods.map((m) => MOODS.find((x) => x.id === m)?.label ?? m).join(", ") : "all moods"}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={() => { setDraft({ id: c.id, title: c.title, blurb: c.blurb, emoji: c.emoji, tags: c.tags, moods: c.moods, sort_order: c.sort_order, is_active: c.is_active }); setError(""); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${COLORS.line}`, background: "none", color: COLORS.parchment, fontSize: 12, cursor: "pointer" }}>
                Edit
              </button>
              <button onClick={() => remove(c)} disabled={busy} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${COLORS.line}`, background: "none", color: COLORS.danger, fontSize: 12, cursor: "pointer" }}>
                Delete
              </button>
              <Link href={`/feed?collection=${c.id}`} style={{ marginLeft: "auto", alignSelf: "center", color: COLORS.brass, fontSize: 12, textDecoration: "none" }}>
                Open →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}
