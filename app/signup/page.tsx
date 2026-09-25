"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Shell, Logo } from "@/components/ui/Shell";
import { Btn } from "@/components/ui/Btn";
import { COLORS } from "@/lib/constants";

// Only viewer/creator are offered here. Admin is never self-service —
// an existing admin has to promote someone via the profiles table
// (see README "Promoting an admin"). This closes the prototype's gap
// where anyone could declare themselves Admin at login.
const SIGNUP_ROLES = [
  { key: "viewer", label: "Viewer", desc: "Browse the feed" },
  { key: "creator", label: "Creator", desc: "Submit content for review" },
] as const;

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"viewer" | "creator">("viewer");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    setError("");
    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name.trim() } },
    });
    if (signUpError) {
      setLoading(false);
      setError(signUpError.message);
      return;
    }
    // The `handle_new_user` trigger creates the profiles row with role
    // defaulted to 'viewer'. If the person chose 'creator', apply that
    // now — the profiles update policy allows a user to edit their own
    // row (role escalation to 'admin' is separately blocked server-side).
    if (data.user && role === "creator") {
      await supabase.from("profiles").update({ role: "creator" }).eq("id", data.user.id);
    }
    setLoading(false);
    router.replace("/onboarding");
    router.refresh();
  };

  return (
    <Shell>
      <div style={{ padding: "56px 28px", display: "flex", flexDirection: "column", minHeight: 720 }}>
        <Logo />
        <p style={{ color: COLORS.slate, fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>
          Create an account to build your feed.
        </p>
        <div style={{ marginTop: 32 }}>
          <label className="mf-label">Your name</label>
          <input className="mf-input" placeholder="e.g. Sam" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="mf-label">Email</label>
          <input className="mf-input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label className="mf-label">Password</label>
          <input className="mf-input" type="password" placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
          <label className="mf-label" style={{ marginTop: 8 }}>
            Role
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {SIGNUP_ROLES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRole(r.key)}
                style={{
                  textAlign: "left",
                  padding: "12px 14px",
                  borderRadius: 8,
                  border: `1px solid ${role === r.key ? COLORS.brass : COLORS.line}`,
                  background: role === r.key ? "rgba(201,162,39,0.08)" : "transparent",
                  cursor: "pointer",
                }}
              >
                <div style={{ color: COLORS.parchment, fontSize: 13, fontWeight: 500 }}>{r.label}</div>
                <div style={{ color: COLORS.slate, fontSize: 12 }}>{r.desc}</div>
              </button>
            ))}
          </div>
          {error && <p style={{ color: COLORS.danger, fontSize: 12, margin: "12px 0 0" }}>{error}</p>}
        </div>
        <div style={{ flex: 1 }} />
        <Btn
          variant="primary"
          disabled={!name.trim() || !email.trim() || password.length < 6 || loading}
          onClick={handleSignup}
          style={{ justifyContent: "center", padding: "13px 16px" }}
        >
          {loading ? "Creating account…" : "Create account"}
        </Btn>
        <p style={{ color: COLORS.slate, fontSize: 12, textAlign: "center", marginTop: 16 }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: COLORS.brass }}>
            Sign in
          </Link>
        </p>
      </div>
    </Shell>
  );
}
