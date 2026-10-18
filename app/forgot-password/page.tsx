"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Field, FormError, SubmitButton } from "@/components/auth/Fields";
import { friendlyAuthError } from "@/lib/auth-errors";
import { COLORS } from "@/lib/constants";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(friendlyAuthError(error.message));
      setAttempt((a) => a + 1);
      return;
    }
    setSent(true);
  };

  return (
    <AuthLayout title={sent ? "Check your inbox" : "Reset your password"} subtitle={sent ? undefined : "Enter your email and we'll send you a link to set a new one."}>
      {sent ? (
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div className="au-fade" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <MailCheck size={22} color={COLORS.brass} style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ color: COLORS.parchment, fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              If an account exists for <strong>{email.trim()}</strong>, a reset link is on its way. Open it on this device to choose a new password. It can take a minute, and may land in spam.
            </p>
          </div>
          <div style={{ flex: 1 }} />
          <p style={{ color: COLORS.slate, fontSize: 13, textAlign: "center", margin: "18px 0 0" }}>
            <Link href="/login" className="au-link">
              Back to sign in
            </Link>
          </p>
        </div>
      ) : (
        <form onSubmit={handleSend} noValidate style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <Field label="Email" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <FormError message={error} attempt={attempt} />
          <div style={{ flex: 1, minHeight: 8 }} />
          <SubmitButton loading={loading} loadingText="Sending…" disabled={!email.trim()}>
            Send reset link
          </SubmitButton>
          <p style={{ color: COLORS.slate, fontSize: 13, textAlign: "center", margin: "18px 0 0" }}>
            Remembered it?{" "}
            <Link href="/login" className="au-link">
              Sign in
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
