"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Field, FormError, SubmitButton } from "@/components/auth/Fields";
import { friendlyAuthError } from "@/lib/auth-errors";
import { COLORS } from "@/lib/constants";

// Only viewer/creator are offered here. Admin is never self-service —
// an existing admin has to promote someone via the profiles table
// (see README "Promoting an admin").
const SIGNUP_ROLES = [
  { key: "viewer", label: "Read", desc: "Browse the feed" },
  { key: "creator", label: "Read and share", desc: "Also submit quotes for review" },
] as const;

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [role, setRole] = useState<"viewer" | "creator">("viewer");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(false);

  const ready = !!name.trim() && !!email.trim() && password.length >= 6;

  const fail = (msg: string) => {
    setLoading(false);
    setError(msg);
    setAttempt((a) => a + 1);
  };

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setError("");
    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: name.trim() } },
    });
    if (signUpError) return fail(friendlyAuthError(signUpError.message));

    // The `handle_new_user` trigger creates the profiles row with role
    // 'viewer'. Apply the chosen role and the optional birthdate (which is
    // what unlocks mature content) now; the update policy allows a user to
    // edit their own row, and escalation to admin is blocked server-side.
    if (data.user) {
      const patch: Record<string, unknown> = {};
      if (role === "creator") patch.role = "creator";
      if (birthdate) patch.birthdate = birthdate;
      if (Object.keys(patch).length > 0) {
        await supabase.from("profiles").update(patch).eq("id", data.user.id);
      }
    }
    setLoading(false);
    router.replace("/onboarding");
    router.refresh();
  };

  return (
    <AuthLayout compact title="Begin" subtitle="One focused hour a day, and a few words worth keeping.">
      <form onSubmit={handleSignup} noValidate style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <Field label="Your name" autoComplete="given-name" placeholder="e.g. Sam" value={name} onChange={(e) => setName(e.target.value)} />
        <Field label="Email" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={password && password.length < 6 ? `${6 - password.length} more ${6 - password.length === 1 ? "character" : "characters"} to go` : undefined}
        />
        <Field
          label="Date of birth (optional)"
          type="date"
          value={birthdate}
          onChange={(e) => setBirthdate(e.target.value)}
          max={new Date().toISOString().slice(0, 10)}
          hint="Only used to show age-appropriate content. You can add it later."
        />

        <span className="au-label" style={{ marginTop: 4 }}>
          How will you use Discipline?
        </span>
        <div role="group" aria-label="How will you use Discipline?" style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {SIGNUP_ROLES.map((r) => (
            <button key={r.key} type="button" className="au-choice" aria-pressed={role === r.key} onClick={() => setRole(r.key)} style={{ flex: 1 }}>
              <div style={{ color: COLORS.parchment, fontSize: 14, fontWeight: 500 }}>{r.label}</div>
              <div style={{ color: COLORS.slate, fontSize: 12, marginTop: 2 }}>{r.desc}</div>
            </button>
          ))}
        </div>

        <FormError message={error} attempt={attempt} />
        <div style={{ flex: 1 }} />
        <SubmitButton loading={loading} loadingText="Creating your account…" disabled={!ready}>
          Create account
        </SubmitButton>
        <p style={{ color: COLORS.slate, fontSize: 13, textAlign: "center", margin: "18px 0 0" }}>
          Already have an account?{" "}
          <Link href="/login" className="au-link">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
