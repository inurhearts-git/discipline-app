"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Field, FormError, SubmitButton } from "@/components/auth/Fields";
import { COLORS, isAdult } from "@/lib/constants";
import { MIN_AGE } from "@/lib/legal";

// daysLeft: days until the old details are erased, or null if they already are.
export function WelcomeBackClient({ email, daysLeft }: { email: string; daysLeft: number | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<"choose" | "fresh">(daysLeft === null ? "fresh" : "choose");
  const [loading, setLoading] = useState<"restore" | "fresh" | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [birthdate, setBirthdate] = useState("");
  const [agreed, setAgreed] = useState(false);

  const fail = (msg: string) => {
    setLoading(null);
    setError(msg);
    setAttempt((a) => a + 1);
  };

  const restore = async () => {
    setError("");
    setLoading("restore");
    try {
      const res = await fetch("/api/account/restore", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 410) setMode("fresh");
        return fail(data.error || "Couldn't restore your account. Please try again.");
      }
      router.replace("/feed");
      router.refresh();
    } catch {
      fail("Couldn't restore your account. Check your connection and try again.");
    }
  };

  const startFresh = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading("fresh");
    try {
      const res = await fetch("/api/account/fresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birthdate, accept: agreed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return fail(data.error || "Couldn't start fresh. Please try again.");
      router.replace("/onboarding");
      router.refresh();
    } catch {
      fail("Couldn't start fresh. Check your connection and try again.");
    }
  };

  const signOut = async () => {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  const oldEnough = !!birthdate && isAdult(birthdate);
  const tooYoung = !!birthdate && !oldEnough;

  return (
    <AuthLayout
      compact
      quote={null}
      title="Welcome back"
      subtitle={
        <>
          It looks like you used Discipline before with <strong style={{ color: COLORS.parchment, fontWeight: 500 }}>{email}</strong>.
        </>
      }
    >
      {mode === "choose" ? (
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <p style={{ color: COLORS.slate, fontSize: 13, lineHeight: 1.6, margin: "0 0 18px" }}>
            Your journal, reflections, saved quotes and streak are kept safe, and can be restored for {daysLeft} more {daysLeft === 1 ? "day" : "days"}. After that they are erased for good.
          </p>
          <FormError message={error} attempt={attempt} />
          <button type="button" className="au-btn" onClick={restore} disabled={loading !== null} aria-busy={loading === "restore"}>
            {loading === "restore" && <span className="au-spinner" aria-hidden />}
            {loading === "restore" ? "Restoring…" : "Pick up where I left off"}
          </button>
          <button type="button" className="au-choice" onClick={() => setMode("fresh")} disabled={loading !== null} style={{ marginTop: 10, textAlign: "center" }}>
            <div style={{ color: COLORS.parchment, fontSize: 14, fontWeight: 500 }}>Start a new journey</div>
            <div style={{ color: COLORS.slate, fontSize: 12, marginTop: 2 }}>Your old details will be erased</div>
          </button>
          <div style={{ flex: 1 }} />
          <p style={{ color: COLORS.slate, fontSize: 13, textAlign: "center", margin: "18px 0 0" }}>
            Not you?{" "}
            <button type="button" className="au-link" onClick={signOut} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}>
              Sign out
            </button>
          </p>
        </div>
      ) : (
        <form onSubmit={startFresh} noValidate style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <p style={{ color: COLORS.slate, fontSize: 13, lineHeight: 1.6, margin: "0 0 16px" }}>
            {daysLeft === null
              ? "Your old details are no longer kept. You can begin again with the same email."
              : "Starting a new journey erases your old details for good. You can't undo it."}
          </p>
          <Field
            label="Date of birth"
            type="date"
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            hint={tooYoung ? `Discipline is for people aged ${MIN_AGE} or over.` : `You must be ${MIN_AGE} or older. Used only to check your age.`}
          />
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", margin: "0 0 16px", cursor: "pointer" }}>
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: 3, width: 16, height: 16, accentColor: "var(--brass)", flexShrink: 0 }} />
            <span style={{ fontSize: 12, lineHeight: 1.55, color: COLORS.slate }}>
              I am {MIN_AGE} or older and I agree to the{" "}
              <Link href="/terms" target="_blank" className="au-link">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" target="_blank" className="au-link">
                Privacy
              </Link>
              .
            </span>
          </label>
          <FormError message={error} attempt={attempt} />
          <div style={{ flex: 1 }} />
          <SubmitButton loading={loading === "fresh"} loadingText="Starting fresh…" disabled={!oldEnough || !agreed || loading !== null}>
            Start my new journey
          </SubmitButton>
          {daysLeft !== null && (
            <p style={{ color: COLORS.slate, fontSize: 13, textAlign: "center", margin: "18px 0 0" }}>
              <button type="button" className="au-link" onClick={() => setMode("choose")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}>
                Back
              </button>
            </p>
          )}
        </form>
      )}
    </AuthLayout>
  );
}
