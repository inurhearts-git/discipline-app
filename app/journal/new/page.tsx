import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewEntryClient } from "@/components/journal/NewEntryClient";

export default async function NewJournalEntryPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <NewEntryClient />;
}
