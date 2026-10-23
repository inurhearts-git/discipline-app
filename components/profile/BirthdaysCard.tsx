"use client";

import { useState } from "react";
import { Cake, Plus, Trash2 } from "lucide-react";
import { COLORS } from "@/lib/constants";
import { MONTHS, RELATIONS, daysInMonth, fmtBirthday, relationById } from "@/lib/birthdays";

export interface BirthdayRow {
  id: string;
  relation: string;
  pronoun: string;
  month: number;
  day: number;
}

const select = { width: "100%", marginBottom: 10 } as const;

// Profile > Birthdays: people close to you, without names. On the day you
// get a reminder at 9 AM with a quote to send. `initial` is null before
// migration 0019.
export function BirthdaysCard({ initial }: { initial: BirthdayRow[] | null }) {
  const [rows, setRows] = useState(initial ?? []);
  const [adding, setAdding] = useState(false);
  const [relation, setRelation] = useState("spouse");
  const [pronoun, setPronoun] = useState("her");
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rel = relationById(relation);
  const sorted = [...rows].sort((a, b) => a.month - b.month || a.day - b.day);

  const add = async () => {
    setBusy(true);
    setError("");
    const res = await fetch("/api/birthdays", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ relation, pronoun, month, day }) }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) return setError(data.error || "Couldn't save that. Try again.");
    setRows((r) => [...r, data.birthday]);
    setAdding(false);
  };
  const remove = async (id: string) => {
    const before = rows;
    setRows((r) => r.filter((x) => x.id !== id));
    const res = await fetch("/api/birthdays", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => null);
    if (!res?.ok) {
      setRows(before);
      setError("Couldn't remove that. Try again.");
    }
  };

  return (
    <div id="birthdays" style={{ border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 14, marginBottom: 12, scrollMarginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Cake size={14} color={COLORS.brass} />
        <span style={{ fontSize: 12, color: COLORS.parchment }}>Birthdays</span>
      </div>
      <p style={{ fontSize: 11, color: COLORS.slate, margin: "0 0 10px", lineHeight: 1.5 }}>
        Add the birthdays of people close to you. No names needed. On the day you get a reminder at 9 AM with a quote to send them.
      </p>
      {initial === null ? (
        <p style={{ fontSize: 12, color: COLORS.slate, margin: 0 }}>Not switched on yet.</p>
      ) : (
        <>
          {sorted.length > 0 && (
            <ul style={{ listStyle: "none", margin: "0 0 10px", padding: 0 }}>
              {sorted.map((b, i) => {
                const r = relationById(b.relation);
                const label = r ? r.label[0].toUpperCase() + r.label.slice(1) : "Someone";
                return (
                  <li key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: i ? `1px solid ${COLORS.line}` : "none" }}>
                    <span style={{ flex: 1, fontSize: 13, color: COLORS.parchment }}>
                      {label}
                      {!r?.pronoun && b.pronoun !== "them" ? <span style={{ color: COLORS.slate }}> ({b.pronoun === "her" ? "she" : "he"})</span> : null}
                    </span>
                    <span style={{ fontSize: 12, color: COLORS.slate }}>{fmtBirthday(b.month, b.day)}</span>
                    <button type="button" onClick={() => remove(b.id)} aria-label={`Remove ${label}'s birthday`} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: COLORS.slate }}>
                      <Trash2 size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {adding ? (
            <div style={{ borderTop: sorted.length ? `1px solid ${COLORS.line}` : "none", paddingTop: sorted.length ? 10 : 0 }}>
              <label className="mf-label" htmlFor="bday-rel">
                Whose birthday
              </label>
              <select id="bday-rel" className="mf-input" style={select} value={relation} onChange={(e) => setRelation(e.target.value)}>
                {RELATIONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    Your {r.label}
                  </option>
                ))}
              </select>
              {!rel?.pronoun && (
                <>
                  <label className="mf-label" htmlFor="bday-pro">
                    In the reminder, call them
                  </label>
                  <select id="bday-pro" className="mf-input" style={select} value={pronoun} onChange={(e) => setPronoun(e.target.value)}>
                    <option value="her">She / her</option>
                    <option value="him">He / him</option>
                    <option value="them">They / them</option>
                  </select>
                </>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 2 }}>
                  <label className="mf-label" htmlFor="bday-month">
                    Month
                  </label>
                  <select
                    id="bday-month"
                    className="mf-input"
                    style={select}
                    value={month}
                    onChange={(e) => {
                      const m = Number(e.target.value);
                      setMonth(m);
                      setDay((d) => Math.min(d, daysInMonth(m)));
                    }}
                  >
                    {MONTHS.map((name, i) => (
                      <option key={name} value={i + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="mf-label" htmlFor="bday-day">
                    Day
                  </label>
                  <select id="bday-day" className="mf-input" style={select} value={day} onChange={(e) => setDay(Number(e.target.value))}>
                    {Array.from({ length: daysInMonth(month) }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={add} disabled={busy} style={{ flex: 1, padding: "9px", borderRadius: 8, border: "none", background: COLORS.brass, color: COLORS.onBrass, fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
                  {busy ? "Saving…" : "Save"}
                </button>
                <button type="button" onClick={() => setAdding(false)} style={{ flex: 1, padding: "9px", borderRadius: 8, border: `1px solid ${COLORS.line}`, background: "transparent", color: COLORS.parchment, fontSize: 13, cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setError("");
                setAdding(true);
              }}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8, border: `1px solid ${COLORS.line}`, background: "transparent", color: COLORS.parchment, fontSize: 12, cursor: "pointer" }}
            >
              <Plus size={14} /> Add a birthday
            </button>
          )}
          {error && (
            <p role="alert" style={{ color: COLORS.danger, fontSize: 12, margin: "8px 0 0" }}>
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
