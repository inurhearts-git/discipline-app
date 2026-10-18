import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EntryClient } from "@/components/journal/EntryClient";
import type { JournalEntry } from "@/lib/journal";

// One journal entry: read it, edit it, or delete it.
export default async function JournalEntryPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: entry } = await supabase
    .from("journal_entries")
    .select("id, body, created_at, updated_at")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle<JournalEntry>();
  if (!entry) notFound();

  return <EntryClient entry={entry} />;
}
