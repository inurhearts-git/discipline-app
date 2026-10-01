"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2 } from "lucide-react";
import { Shell } from "@/components/ui/Shell";
import { Btn } from "@/components/ui/Btn";
import { COLORS, tagColor } from "@/lib/constants";
import type { ContentItem, MaturityRating } from "@/lib/database.types";

export function ModerateClient({ initialPending }: { initialPending: ContentItem[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(initialPending);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Blueprint §6: "content_items.maturity_rating set by whoever submits,
  // reviewed and confirmable by admin at approval time." Tracks any
  // in-review overrides before the admin clicks Approve.
  const [ratings, setRatings] = useState<Record<string, MaturityRating>>(
    Object.fromEntries(initialPending.map((p) => [p.id, p.maturity_rating]))
  );

  const act = async (item: ContentItem, action: "approve" | "reject") => {
    setBusyId(item.id);
    const res = await fetch(`/api/moderate/${item.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, maturity_rating: action === "approve" ? ratings[item.id] : undefined }),
    });
    setBusyId(null);
    if (res.ok) {
      setPending((prev) => prev.filter((p) => p.id !== item.id));
    }
  };

  return (
    <Shell>
      <div style={{ padding: "24px 22px 28px", minHeight: 720, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <button onClick={() => router.push("/profile")} aria-label="Back" style={{ background: "none", border: "none", color: COLORS.slate, cursor: "pointer", fontSize: 13 }}>
            ← Back
          </button>
          <span style={{ fontSize: 12, color: COLORS.slate }}>{pending.length} pending</span>
        </div>
        <h2 style={{ fontFamily: "'Newsreader', serif", fontStyle: "italic", fontSize: 22, color: COLORS.parchment, margin: "0 0 18px" }}>
          Review submissions
        </h2>
        {pending.length === 0 && <p style={{ color: COLORS.slate, fontSize: 13, textAlign: "center", marginTop: 60 }}>Nothing waiting on you.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
          {pending.map((item) => (
            <div key={item.id} style={{ border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 14 }}>
              <span style={{ fontSize: 10, letterSpacing: 1, color: tagColor(item.tag) }}>{item.tag}</span>
              <p style={{ fontFamily: "'Newsreader', serif", fontStyle: "italic", color: COLORS.parchment, fontSize: 15, margin: "6px 0" }}>{item.text}</p>
              <p style={{ fontSize: 12, color: COLORS.slate, margin: "0 0 4px" }}>
                {item.attributed_to}
                {item.source ? ` · ${item.source}` : ""}
              </p>
              <p style={{ fontSize: 11, color: COLORS.slate, margin: "0 0 10px" }}>
                Submitted by {item.submitted_by_profile?.display_name ?? "unknown"}
              </p>

              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {(["general", "mature"] as MaturityRating[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRatings((prev) => ({ ...prev, [item.id]: r }))}
                    style={{
                      flex: 1,
                      padding: "6px 4px",
                      borderRadius: 6,
                      fontSize: 11,
                      textTransform: "capitalize",
                      border: `1px solid ${ratings[item.id] === r ? (r === "mature" ? COLORS.ember : COLORS.brass) : COLORS.line}`,
                      background: ratings[item.id] === r ? (r === "mature" ? "rgba(194,84,46,0.12)" : "rgba(201,162,39,0.1)") : "transparent",
                      color: COLORS.parchment,
                      cursor: "pointer",
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <Btn variant="primary" disabled={busyId === item.id} onClick={() => act(item, "approve")} style={{ flex: 1, justifyContent: "center", padding: "8px" }}>
                  <Check size={14} /> Approve
                </Btn>
                <Btn variant="danger" disabled={busyId === item.id} onClick={() => act(item, "reject")} style={{ flex: 1, justifyContent: "center", padding: "8px" }}>
                  <Trash2 size={14} /> Reject
                </Btn>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}
