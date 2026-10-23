"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, Flame, Layers, CheckCircle2, XCircle, AlertTriangle, Flag, Inbox, Settings2 } from "lucide-react";
import { Shell } from "@/components/ui/Shell";
import { NOTICES_CHANGED } from "@/components/ui/BottomNav";
import { COLORS, alpha } from "@/lib/constants";
import type { NoticeRow } from "@/app/api/notifications/route";

function iconFor(kind: string) {
  switch (kind) {
    case "streak_milestone":
    case "streak_at_risk":
      return { Icon: Flame, color: COLORS.ember };
    case "collection_new":
      return { Icon: Layers, color: COLORS.brass };
    case "submission_approved":
      return { Icon: CheckCircle2, color: COLORS.sage };
    case "submission_rejected":
      return { Icon: XCircle, color: COLORS.danger };
    case "admin_reports":
      return { Icon: Flag, color: COLORS.ember };
    case "admin_submissions":
      return { Icon: Inbox, color: COLORS.brass };
    default:
      return { Icon: AlertTriangle, color: COLORS.ember };
  }
}

// "just now", "5 min ago", "3 h ago", "yesterday", "4 days ago", then a date.
function ago(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d} days ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: d > 300 ? "numeric" : undefined });
}

// Times are worked out after mount, so server and browser render the same HTML.
function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function announce(unread: number) {
  window.dispatchEvent(new CustomEvent(NOTICES_CHANGED, { detail: unread }));
}

export function NotificationsClient({ initial }: { initial: NoticeRow[] }) {
  const router = useRouter();
  const now = useNow();
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const unread = items.filter((n) => !n.read_at).length;

  const markRead = async (body: { id: string } | { all: true }) => {
    const res = await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error();
    const data = await res.json().catch(() => ({}));
    if (typeof data.unread === "number") announce(data.unread);
  };

  const open = async (n: NoticeRow) => {
    setError("");
    if (!n.read_at) {
      const stamp = new Date().toISOString();
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: stamp } : x)));
      announce(Math.max(0, unread - 1));
      markRead({ id: n.id }).catch(() => undefined);
    }
    if (n.link) router.push(n.link);
  };

  const markAll = async () => {
    setBusy(true);
    setError("");
    const before = items;
    const stamp = new Date().toISOString();
    setItems((prev) => prev.map((x) => (x.read_at ? x : { ...x, read_at: stamp })));
    try {
      await markRead({ all: true });
    } catch {
      setItems(before);
      setError("Couldn't mark them read. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <div style={{ padding: "18px 22px 28px", minHeight: 720 }}>
        <Link href="/profile" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: COLORS.slate, fontSize: 13, textDecoration: "none" }}>
          <ArrowLeft size={16} /> Profile
        </Link>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, margin: "18px 0 18px" }}>
          <div>
            <h1 style={{ fontFamily: "'Newsreader', serif", fontStyle: "italic", fontWeight: 400, fontSize: 26, color: COLORS.parchment, margin: "0 0 4px" }}>Notices</h1>
            <p style={{ fontSize: 12, color: COLORS.slate, margin: 0 }}>{unread === 0 ? "All caught up" : `${unread} unread`}</p>
          </div>
          {unread > 0 && (
            <button
              type="button"
              onClick={markAll}
              disabled={busy}
              style={{ background: "none", border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: "7px 10px", color: COLORS.parchment, fontSize: 12, cursor: busy ? "default" : "pointer", opacity: busy ? 0.5 : 1, flexShrink: 0 }}
            >
              Mark all read
            </button>
          )}
        </div>

        {error && (
          <p role="alert" style={{ color: COLORS.danger, fontSize: 12, margin: "0 0 12px" }}>
            {error}
          </p>
        )}

        {items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 12px", color: COLORS.slate, fontSize: 13, lineHeight: 1.7 }}>
            <Bell size={22} color={COLORS.brass} style={{ marginBottom: 10 }} />
            <p style={{ margin: 0 }}>Nothing here yet. Streak milestones, new collections and news about your submissions will show up here.</p>
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((n) => {
              const { Icon, color } = iconFor(n.kind);
              const isUnread = !n.read_at;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => open(n)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                      padding: "12px 12px 12px 14px",
                      borderRadius: 10,
                      border: `1px solid ${isUnread ? alpha(COLORS.brass, 45) : COLORS.line}`,
                      background: isUnread ? alpha(COLORS.brass, 7) : "transparent",
                      cursor: n.link || isUnread ? "pointer" : "default",
                      fontFamily: "inherit",
                    }}
                  >
                    <span style={{ width: 30, height: 30, borderRadius: "50%", background: alpha(color, 14), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon size={15} color={color} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13, lineHeight: 1.4, color: COLORS.parchment, fontWeight: isUnread ? 600 : 500 }}>{n.title}</span>
                      {n.body && <span style={{ display: "block", fontSize: 12, lineHeight: 1.5, color: COLORS.slate, marginTop: 3, overflowWrap: "anywhere" }}>{n.body}</span>}
                      <span suppressHydrationWarning style={{ display: "block", fontSize: 11, color: COLORS.slate, marginTop: 5 }}>
                        {now === null ? " " : ago(n.created_at, now)}
                      </span>
                    </span>
                    {isUnread && <span aria-label="Unread" style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.brass, marginTop: 6, flexShrink: 0 }} />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <Link
          href="/profile#notices"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 22, fontSize: 12, color: COLORS.slate, textDecoration: "none" }}
        >
          <Settings2 size={13} /> Choose which notices you get
        </Link>
      </div>
    </Shell>
  );
}
