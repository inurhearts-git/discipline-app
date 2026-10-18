import { redirect } from "next/navigation";
import { Clock, Flame } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Shell } from "@/components/ui/Shell";
import { ResetCountdown } from "@/components/ui/ResetCountdown";
import { ReflectionBox } from "@/components/ui/ReflectionBox";
import { getTodayReflection } from "@/lib/reflection";
import { COLORS, alpha, fmtClock, todayStr } from "@/lib/constants";
import { STREAK_MIN_MS, streakThroughYesterday } from "@/lib/streak";

interface InteractionRow {
  content_id: string;
  liked: boolean;
  saved: boolean;
  liked_at: string | null;
  saved_at: string | null;
}

interface RecapItem {
  id: string;
  text: string;
  attributed_to: string;
  source: string | null;
}

export default async function LimitPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: usage } = await admin
    .from("usage_sessions")
    .select("ms_spent")
    .eq("user_id", user.id)
    .eq("date", todayStr())
    .maybeSingle();

  const usageMs = usage?.ms_spent ?? 0;

  // Streak: consecutive qualifying days ending yesterday, plus today if it counts.
  const { data: history } = await admin
    .from("usage_sessions")
    .select("date, ms_spent")
    .eq("user_id", user.id)
    .lt("date", todayStr())
    .order("date", { ascending: false })
    .limit(400);
  const streak = streakThroughYesterday(history ?? [], todayStr()) + (usageMs >= STREAK_MIN_MS ? 1 : 0);

  // What they liked or saved today. Needs migration 0006 (liked_at / saved_at);
  // if the columns aren't there yet, this simply comes back empty.
  const startOfToday = `${todayStr()}T00:00:00Z`;
  const { data: todays } = await supabase
    .from("user_content_interactions")
    .select("content_id, liked, saved, liked_at, saved_at")
    .eq("user_id", user.id)
    .or(`liked_at.gte.${startOfToday},saved_at.gte.${startOfToday}`)
    .returns<InteractionRow[]>();

  // A save outranks a like; within each, the most recent comes first.
  const ranked = (todays ?? [])
    .map((r) => {
      const savedToday = r.saved && !!r.saved_at && r.saved_at >= startOfToday;
      const likedToday = r.liked && !!r.liked_at && r.liked_at >= startOfToday;
      const at = Math.max(savedToday ? Date.parse(r.saved_at as string) : 0, likedToday ? Date.parse(r.liked_at as string) : 0);
      return { id: r.content_id, savedToday, likedToday, at };
    })
    .filter((r) => r.savedToday || r.likedToday)
    .sort((a, b) => Number(b.savedToday) - Number(a.savedToday) || b.at - a.at)
    .slice(0, 4);

  let recap: RecapItem[] = [];
  if (ranked.length > 0) {
    const { data: itemRows } = await supabase
      .from("content_items")
      .select("id, text, attributed_to, source")
      .in(
        "id",
        ranked.map((r) => r.id)
      )
      .returns<RecapItem[]>();
    const byId = new Map((itemRows ?? []).map((i) => [i.id, i]));
    recap = ranked.map((r) => byId.get(r.id)).filter((i): i is RecapItem => !!i);
  }
  const [carry, ...more] = recap;
  const reflection = await getTodayReflection(supabase, user.id);

  return (
    <Shell>
      <div
        style={{
          padding: "44px 28px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          minHeight: 720,
          justifyContent: "center",
        }}
      >
        <Clock size={28} color={COLORS.brass} />
        <h2 style={{ fontFamily: "'Newsreader', serif", fontStyle: "italic", fontSize: 22, color: COLORS.parchment, margin: "16px 0 8px" }}>
          That&apos;s your hour for today.
        </h2>
        <p style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: COLORS.slate, fontSize: 13, margin: "0 0 24px" }}>
          <span>{fmtClock(usageMs)} in the feed</span>
          {streak > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: COLORS.ember }}>
                <Flame size={14} /> Day {streak}
              </span>
            </>
          )}
        </p>

        {carry ? (
          <div style={{ width: "100%", maxWidth: 320, textAlign: "left" }}>
            <p style={{ color: COLORS.slate, fontSize: 12, margin: "0 0 8px" }}>Carry this with you</p>
            <div
              style={{
                border: `1px solid ${COLORS.line}`,
                background: alpha(COLORS.brass, 6),
                borderRadius: 12,
                padding: "18px 18px 16px",
              }}
            >
              <p style={{ fontFamily: "'Newsreader', serif", fontStyle: "italic", fontSize: 18, lineHeight: 1.5, color: COLORS.parchment, margin: "0 0 12px" }}>
                {carry.text}
              </p>
              <p style={{ fontSize: 12, color: COLORS.slate, margin: 0 }}>
                {carry.attributed_to}
                {carry.source ? ` · ${carry.source}` : ""}
              </p>
            </div>

            {more.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <p style={{ color: COLORS.slate, fontSize: 12, margin: "0 0 8px" }}>Also from today</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {more.map((m) => (
                    <div key={m.id} style={{ borderLeft: `2px solid ${COLORS.line}`, paddingLeft: 12 }}>
                      <p
                        style={{
                          fontSize: 13,
                          lineHeight: 1.45,
                          color: COLORS.parchment,
                          margin: "0 0 2px",
                          overflow: "hidden",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {m.text}
                      </p>
                      <p style={{ fontSize: 11, color: COLORS.slate, margin: 0 }}>{m.attributed_to}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p style={{ color: COLORS.slate, fontSize: 13, lineHeight: 1.7, maxWidth: 290, margin: 0 }}>
            The point isn&apos;t to scroll longer. It&apos;s to carry one thing with you. Tomorrow, tap the heart or the bookmark on
            whatever lands, and it will be waiting for you here.
          </p>
        )}

        <div style={{ width: "100%", maxWidth: 320, marginTop: 24 }}>
          <ReflectionBox initialText={reflection} contentId={carry?.id ?? null} />
        </div>

        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <ResetCountdown />
          <p style={{ color: COLORS.slate, fontSize: 12, margin: 0 }}>
            {streak > 0 ? `Come back to make it day ${streak + 1}.` : "Come back tomorrow."}
          </p>
        </div>

        <Link
          href="/profile"
          style={{
            marginTop: 24,
            padding: "10px 16px",
            borderRadius: 8,
            border: `1px solid ${COLORS.line}`,
            color: COLORS.parchment,
            textDecoration: "none",
            fontSize: 13,
          }}
        >
          Back to profile
        </Link>
      </div>
    </Shell>
  );
}
