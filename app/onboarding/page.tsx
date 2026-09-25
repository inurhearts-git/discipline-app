"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Shell } from "@/components/ui/Shell";
import { Btn } from "@/components/ui/Btn";
import { CATEGORIES, COLORS, tagColor } from "@/lib/constants";
import type { ContentTag } from "@/lib/database.types";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [selected, setSelected] = useState<ContentTag[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("interests").eq("id", user.id).single();
      if (data?.interests) setSelected(data.interests);
    })();
  }, [supabase]);

  const toggle = (key: ContentTag) =>
    setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));

  const handleDone = async () => {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ interests: selected, onboarded: true }).eq("id", user.id);
    }
    setSaving(false);
    router.replace("/feed");
    router.refresh();
  };

  return (
    <Shell>
      <div style={{ padding: "48px 24px", display: "flex", flexDirection: "column", minHeight: 720 }}>
        <span className="mf-label">Step 1 of 1</span>
        <h2
          style={{
            fontFamily: "'Newsreader', serif",
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: 24,
            color: COLORS.parchment,
            margin: "6px 0 6px",
          }}
        >
          What should your feed be made of?
        </h2>
        <p style={{ color: COLORS.slate, fontSize: 13, margin: "0 0 24px" }}>
          Pick as many as you like. You can change this anytime.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {CATEGORIES.map((c) => {
            const active = selected.includes(c.key);
            return (
              <button
                key={c.key}
                onClick={() => toggle(c.key)}
                style={{
                  textAlign: "left",
                  padding: "16px 16px",
                  borderRadius: 10,
                  border: `1px solid ${active ? tagColor(c.key) : COLORS.line}`,
                  background: active ? "rgba(201,162,39,0.06)" : "transparent",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ color: COLORS.parchment, fontSize: 15, fontWeight: 500 }}>{c.label}</div>
                  <div style={{ color: COLORS.slate, fontSize: 12, marginTop: 2 }}>{c.desc}</div>
                </div>
                {active && <Check size={18} color={tagColor(c.key)} />}
              </button>
            );
          })}
        </div>
        <div style={{ flex: 1 }} />
        <Btn variant="primary" disabled={saving} onClick={handleDone} style={{ justifyContent: "center", padding: "13px 16px" }}>
          {selected.length ? "Build my feed" : "Show me everything"}
        </Btn>
      </div>
    </Shell>
  );
}
