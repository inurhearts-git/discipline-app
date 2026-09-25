"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Shell, Logo } from "@/components/ui/Shell";
import { Btn } from "@/components/ui/Btn";
import { COLORS } from "@/lib/constants";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  };

  return (
    <Shell>
      <div style={{ padding: "56px 28px", display: "flex", flexDirection: "column", minHeight: 720 }}>
        <Logo />
        <p style={{ color: COLORS.slate, fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>
          Reset your password.
        </p>

        {sent ? (
          <div style={{ marginTop: 40 }}>
            <p style={{ color: COLORS.parchment, fontSize: 14, lineHeight: 1.6 }}>
              If an account exists for <strong>{email}</strong>, a reset link has been sent. Check your inbox
              (and spam folder) and follow the link to set a new password.
            </p>
          </div>
        ) : (
          <div style={{ marginTop: 40 }}>
            <label className="mf-label">Email</label>
            <input
              className="mf-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
            />
            {error && <p style={{ color: COLORS.danger, fontSize: 12, margin: "0 0 12px" }}>{error}</p>}
          </div>
        )}

        <div style={{ flex: 1 }} />
        {!sent && (
          <Btn
            variant="primary"
            disabled={!email.trim() || loading}
            onClick={handleSend}
            style={{ justifyContent: "center", padding: "13px 16px" }}
          >
            {loading ? "Sending…" : "Send reset link"}
          </Btn>
        )}
        <p style={{ color: COLORS.slate, fontSize: 12, textAlign: "center", marginTop: 16 }}>
          <Link href="/login" style={{ color: COLORS.brass }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </Shell>
  );
}
