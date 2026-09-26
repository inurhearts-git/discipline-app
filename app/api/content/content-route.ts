import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ContentTag, ContentType } from "@/lib/database.types";

// GET /api/content — approved feed items, RLS already restricts this to
// status='approved' (plus your own submissions) so there's nothing extra
// to enforce here beyond being signed in.
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await supabase
    .from("content_items")
    .select(
      "id, type, tag, text, attributed_to, source, video_platform, video_id, maturity_rating, status, view_count, created_at"
    )
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}

// POST /api/content — submit content for review. RLS (see migration)
// already blocks anyone who isn't a creator/admin, and forces
// status='pending' and submitted_by=self regardless of what's sent — this
// route re-checks role first only to return a friendlier error message.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role === "viewer") {
    return NextResponse.json({ error: "Only creators and admins can submit content" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { type, tag, text, attributed_to, source, video_id } = body as {
    type: ContentType;
    tag: ContentTag;
    text: string;
    attributed_to: string;
    source?: string;
    video_id?: string;
  };

  if (!type || !tag || !text?.trim() || !attributed_to?.trim()) {
    return NextResponse.json({ error: "Add both the text and who it's from." }, { status: 400 });
  }
  if (type === "video" && !video_id?.trim()) {
    return NextResponse.json({ error: "Add a YouTube video ID for a speech clip." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("content_items")
    .insert({
      type,
      tag,
      text: text.trim(),
      attributed_to: attributed_to.trim(),
      source: source?.trim() || null,
      video_platform: type === "video" ? "youtube" : null,
      video_id: type === "video" ? video_id!.trim() : null,
      status: "pending",
      submitted_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data }, { status: 201 });
}
