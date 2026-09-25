"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Shell, Logo } from "@/components/ui/Shell";
import { Btn } from "@/components/ui/Btn";
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
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
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
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  const handleReset = async () => {
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.replace("/feed");
      router.refresh();
    }, 1500);
  };

  return (
    <Shell>
      <div style={{ padding: "56px 28px", display: "flex", flexDirection: "column", minHeight: 720 }}>
        <Logo />
        <p style={{ color: COLORS.slate, fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>
          Set a new password.
        </p>

        {!ready && !done && (
          <p style={{ color: COLORS.slate, fontSize: 13, marginTop: 40 }}>
            Verifying your reset link…
          </p>
        )}

        {ready && !done && (
          <div style={{ marginTop: 40 }}>
            <label className="mf-label">New password</label>
            <input
              className="mf-input"
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <label className="mf-label">Confirm password</label>
            <input
              className="mf-input"
              type="password"
              placeholder="Repeat password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleReset()}
            />
            {error && <p style={{ color: COLORS.danger, fontSize: 12, margin: "0 0 12px" }}>{error}</p>}
          </div>
        )}

        {done && (
          <p style={{ color: COLORS.parchment, fontSize: 14, marginTop: 40 }}>
            Password updated. Taking you to your feed…
          </p>
        )}

        <div style={{ flex: 1 }} />
        {ready && !done && (
          <Btn
            variant="primary"
            disabled={!password || !confirm || loading}
            onClick={handleReset}
            style={{ justifyContent: "center", padding: "13px 16px" }}
          >
            {loading ? "Updating…" : "Update password"}
          </Btn>
        )}
      </div>
    </Shell>
  );
}
