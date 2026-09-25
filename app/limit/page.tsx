import { redirect } from "next/navigation";
import { Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Shell } from "@/components/ui/Shell";
import { COLORS, fmtClock, todayStr } from "@/lib/constants";
import Link from "next/link";

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

  return (
    <Shell>
      <div style={{ padding: "56px 28px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", minHeight: 720, justifyContent: "center" }}>
        <Clock size={32} color={COLORS.brass} />
        <h2 style={{ fontFamily: "'Newsreader', serif", fontStyle: "italic", fontSize: 22, color: COLORS.parchment, margin: "18px 0 8px" }}>
          That&apos;s your hour for today.
        </h2>
        <p style={{ color: COLORS.slate, fontSize: 13, lineHeight: 1.7, maxWidth: 280 }}>
          You&apos;ve spent {fmtClock(usageMs)} in the feed today. The point isn&apos;t to scroll longer — it&apos;s to carry one thing with you. Come back tomorrow.
        </p>
        <Link
          href="/profile"
          style={{
            marginTop: 28,
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
