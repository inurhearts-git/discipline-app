"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { COLORS, alpha } from "@/lib/constants";

// "Delete my account" at the bottom of the Profile, with a confirm popup.
export function DeleteAccount({ isAdmin, retentionDays }: { isAdmin: boolean; retentionDays: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy]);

  const confirm = async () => {
    if (typed !== "DELETE" || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't delete your account. Nothing was lost. Please try again.");
        setBusy(false);
        return;
      }
      await createClient().auth.signOut();
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Couldn't delete your account. Check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <>
      <div style={{ marginTop: 22, textAlign: "center" }}>
        {isAdmin ? (
          <p style={{ margin: 0, fontSize: 11, lineHeight: 1.55, color: COLORS.slate }}>Admins can&apos;t delete their account here. Ask another admin to change your role first.</p>
        ) : (
          <button
            onClick={() => setOpen(true)}
            style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.slate, fontSize: 12, textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Trash2 size={13} aria-hidden /> Delete my account
          </button>
        )}
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-title"
          onClick={() => !busy && setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 60, background: alpha(COLORS.ink, 78), display: "flex", alignItems: "center", justifyContent: "center", padding: 22 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: "relative", width: "100%", maxWidth: 340, background: COLORS.ink2, border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: "20px 20px 20px", boxShadow: `0 18px 50px ${alpha("#000000", 35)}` }}
          >
            <button
              ref={closeRef}
              onClick={() => !busy && setOpen(false)}
              aria-label="Close"
              style={{ position: "absolute", top: 10, right: 10, width: 34, height: 34, borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <X size={18} color={COLORS.slate} />
            </button>
            <h2 id="delete-title" style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 600, color: COLORS.parchment, paddingRight: 30 }}>
              Delete your account?
            </h2>
            <p style={{ margin: "0 0 10px", fontSize: 13, lineHeight: 1.6, color: COLORS.parchment }}>
              You&apos;ll be signed out and your journal, reflections, saved quotes, streak and details are hidden straight away.
            </p>
            <p style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.6, color: COLORS.slate }}>
              We keep them in an encrypted archive for {retentionDays} days. If you sign in again with the same email in that time, you can pick up where you left off or start fresh. After that they are erased for good.
            </p>
            <label htmlFor="delete-confirm" style={{ display: "block", fontSize: 12, color: COLORS.slate, marginBottom: 6 }}>
              Type <strong style={{ color: COLORS.parchment }}>DELETE</strong> to confirm
            </label>
            <input id="delete-confirm" className="mf-input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters" style={{ marginBottom: 10 }} />
            {error && (
              <p role="alert" style={{ margin: "0 0 10px", fontSize: 12, color: COLORS.danger }}>
                {error}
              </p>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.line}`, background: "none", color: COLORS.parchment, fontSize: 13, cursor: "pointer" }}
              >
                Keep my account
              </button>
              <button
                onClick={confirm}
                disabled={typed !== "DELETE" || busy}
                style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "none", background: COLORS.danger, color: COLORS.onDanger, fontSize: 13, fontWeight: 500, cursor: typed === "DELETE" && !busy ? "pointer" : "default", opacity: typed === "DELETE" && !busy ? 1 : 0.4 }}
              >
                {busy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
