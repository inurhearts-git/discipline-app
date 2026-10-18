"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Field, FormError, SubmitButton } from "@/components/auth/Fields";
import { friendlyAuthError } from "@/lib/auth-errors";
import { COLORS } from "@/lib/constants";

// Reached via the link Supabase emails from resetPasswordForEmail(). The
// email link contains a token in the URL fragment; the Supabase browser
// client automatically exchanges that for a temporary "recovery" session
// on load (detectSessionInUrl, on by default). We just wait for that
// session to exist, then let the person set a new password.
export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    // Fallback in case the event already fired before this listener attached.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    const t = setTimeout(() => setSlow(true), 6000);
    return () => {
      listener.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, [supabase]);

  const fail = (msg: string) => {
    setError(msg);
    setAttempt((a) => a + 1);
  };

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) return fail("Use a password of at least 6 characters.");
    if (password !== confirm) return fail("The two passwords don't match. Type the same one in both boxes.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return fail(friendlyAuthError(error.message));
    setDone(true);
    setTimeout(() => {
      router.replace("/feed");
      router.refresh();
    }, 1500);
  };

  return (
    <AuthLayout title={done ? "Password updated" : "Choose a new password"} subtitle={done ? undefined : ready ? "Pick something you'll remember." : undefined}>
      {done ? (
        <div className="au-fade" style={{ display: "flex", gap: 12, alignItems: "center", color: COLORS.parchment, fontSize: 14 }}>
          <CheckCircle2 size={22} color={COLORS.sage} /> Taking you to your feed…
        </div>
      ) : !ready ? (
        <div style={{ color: COLORS.slate, fontSize: 14, lineHeight: 1.6 }}>
          <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <span className="au-spinner" style={{ borderColor: "var(--line)", borderTopColor: "var(--brass)" }} aria-hidden /> Checking your reset link…
          </p>
          {slow && (
            <p className="au-fade" style={{ margin: "14px 0 0" }}>
              This is taking a while. The link may have expired.{" "}
              <Link href="/forgot-password" className="au-link">
                Send a new one
              </Link>
              .
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={handleReset} noValidate style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <Field label="New password" type="password" autoComplete="new-password" placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Field label="Confirm new password" type="password" autoComplete="new-password" placeholder="Type it again" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <FormError message={error} attempt={attempt} />
          <div style={{ flex: 1, minHeight: 8 }} />
          <SubmitButton loading={loading} loadingText="Saving…" disabled={!password || !confirm}>
            Save new password
          </SubmitButton>
        </form>
      )}
    </AuthLayout>
  );
}
