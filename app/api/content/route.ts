import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdult } from "@/lib/constants";
import type { ContentTag, ContentType, MaturityRating } from "@/lib/database.types";

// GET /api/content — approved feed items, RLS already restricts this to
// status='approved' (plus your own submissions). Blueprint §6: mature
// content is additionally filtered out here unless the caller's profile
// implies 18+ — this mirrors the same filter applied in app/feed/page.tsx
// so this route (used by anything other than the main feed page) can't
// become a bypass.
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("birthdate").eq("id", user.id).single();

  let query = supabase
    .from("content_items")
    .select(
      "id, type, tag, text, attributed_to, source, video_platform, video_id, maturity_rating, status, view_count, created_at"
    )
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (!isAdult(profile?.birthdate ?? null)) {
    query = query.eq("maturity_rating", "general");
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}

// POST /api/content — submit content for review. RLS (see migration)
// already blocks anyone who isn't a creator/admin, and forces
// status='pending' and submitted_by=self regardless of what's sent — this
// route re-checks role first only to return a friendlier error message.
//
// Blueprint §4 "turning search results into a collection": when a video is
// submitted with a person_name (selected from a YouTube search result),
// find or create the matching `people` row and link content_items.person_id
// to it, so approved videos can eventually be grouped by person.
//
// Blueprint §6: the submitter picks an initial maturity_rating (default
// 'general'); an admin can still confirm or override it at approval time
// in /api/moderate/[id].
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
  const {
    type,
    tag,
    text,
    attributed_to,
    source,
    video_id,
    person_name,
    youtube_channel_id,
    maturity_rating,
  } = body as {
    type: ContentType;
    tag: ContentTag;
    text: string;
    attributed_to: string;
    source?: string;
    video_id?: string;
    person_name?: string;
    youtube_channel_id?: string;
    maturity_rating?: MaturityRating;
  };

  if (!type || !tag || !text?.trim() || !attributed_to?.trim()) {
    return NextResponse.json({ error: "Add both the text and who it's from." }, { status: 400 });
  }
  if (type === "video" && !video_id?.trim()) {
    return NextResponse.json({ error: "Add a YouTube video ID for a speech clip." }, { status: 400 });
  }

  let personId: string | null = null;
  if (type === "video" && person_name?.trim()) {
    const name = person_name.trim();
    const { data: existingPerson } = await supabase
      .from("people")
      .select("id")
      .ilike("name", name)
      .maybeSingle();

    if (existingPerson) {
      personId = existingPerson.id;
    } else {
      const { data: newPerson, error: personError } = await supabase
        .from("people")
        .insert({ name, youtube_channel_id: youtube_channel_id || null })
        .select("id")
        .single();
      if (personError) {
        return NextResponse.json({ error: `Couldn't save the person record: ${personError.message}` }, { status: 500 });
      }
      personId = newPerson.id;
    }
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
      person_id: personId,
      maturity_rating: maturity_rating === "mature" ? "mature" : "general",
      status: "pending",
      submitted_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data }, { status: 201 });
}
