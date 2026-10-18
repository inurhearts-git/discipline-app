"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Field, FormError, SubmitButton } from "@/components/auth/Fields";
import { friendlyAuthError } from "@/lib/auth-errors";
import { COLORS } from "@/lib/constants";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setLoading(false);
      setError(friendlyAuthError(error.message));
      setAttempt((a) => a + 1);
      return;
    }
    router.replace("/");
    router.refresh();
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Your hour is waiting. Sign in to continue.">
      <form onSubmit={handleLogin} noValidate style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <Field label="Email" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Password" type="password" autoComplete="current-password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div style={{ textAlign: "right", margin: "-4px 2px 16px", fontSize: 13 }}>
          <Link href="/forgot-password" className="au-link">
            Forgot password?
          </Link>
        </div>
        <FormError message={error} attempt={attempt} />
        <div style={{ flex: 1, minHeight: 8 }} />
        <SubmitButton loading={loading} loadingText="Signing in…" disabled={!email.trim() || !password}>
          Sign in
        </SubmitButton>
        <p style={{ color: COLORS.slate, fontSize: 13, textAlign: "center", margin: "18px 0 0" }}>
          New here?{" "}
          <Link href="/signup" className="au-link">
            Create an account
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
