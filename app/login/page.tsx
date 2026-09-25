"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Shell, Logo } from "@/components/ui/Shell";
import { Btn } from "@/components/ui/Btn";
import { COLORS } from "@/lib/constants";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace("/");
    router.refresh();
  };

  return (
    <Shell>
      <div style={{ padding: "56px 28px", display: "flex", flexDirection: "column", minHeight: 720 }}>
        <Logo />
        <p style={{ color: COLORS.slate, fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>
          A feed built for focus, not scrolling. Sign in to continue.
        </p>
        <div style={{ marginTop: 40 }}>
          <label className="mf-label">Email</label>
          <input
            className="mf-input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label className="mf-label">Password</label>
          <input
            className="mf-input"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
          {error && <p style={{ color: COLORS.danger, fontSize: 12, margin: "0 0 12px" }}>{error}</p>}
        </div>
        <div style={{ flex: 1 }} />
        <Btn
          variant="primary"
          disabled={!email.trim() || !password.trim() || loading}
          onClick={handleLogin}
          style={{ justifyContent: "center", padding: "13px 16px" }}
        >
          {loading ? "Signing in…" : "Continue"}
        </Btn>
        <p style={{ color: COLORS.slate, fontSize: 12, textAlign: "center", marginTop: 16 }}>
          New here?{" "}
          <Link href="/signup" style={{ color: COLORS.brass }}>
            Create an account
          </Link>
        </p>
      </div>
    </Shell>
  );
}
