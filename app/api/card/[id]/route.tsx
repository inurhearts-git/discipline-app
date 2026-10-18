import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { H, QuoteCard, W, type CardItem } from "@/lib/quote-card";

export const runtime = "edge";

// GET /api/card/[id]?theme=dark|light
// A 1080x1350 (4:5) PNG of a quote, for sharing to WhatsApp, Instagram and the
// like. Only for signed-in users and approved items (RLS on content_items).
// Fonts are bundled next to this file (Fontsource, SIL Open Font License).
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Not authenticated", { status: 401 });

  const { data: item } = await supabase
    .from("content_items")
    .select("text, attributed_to, source, tag")
    .eq("id", params.id)
    .eq("status", "approved")
    .maybeSingle<CardItem>();
  if (!item) return new Response("Not found", { status: 404 });

  const theme = new URL(request.url).searchParams.get("theme") === "light" ? "light" : "dark";

  const [serif, sans] = await Promise.all([
    fetch(new URL("./fonts/newsreader-latin-400-italic.woff", import.meta.url)).then((r) => r.arrayBuffer()),
    fetch(new URL("./fonts/space-grotesk-latin-500-normal.woff", import.meta.url)).then((r) => r.arrayBuffer()),
  ]);

  return new ImageResponse(<QuoteCard item={item} theme={theme} />, {
    width: W,
    height: H,
    fonts: [
      { name: "Newsreader", data: serif, style: "italic", weight: 400 },
      { name: "Space Grotesk", data: sans, style: "normal", weight: 500 },
    ],
    headers: { "Cache-Control": "private, max-age=3600" },
  });
}
