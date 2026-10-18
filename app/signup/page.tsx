import { getPublicQuoteOfTheDay } from "@/lib/qotd-public";
import { SignupClient } from "./SignupClient";

// Rendered per request so the stage always shows today's quote of the day.
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const q = await getPublicQuoteOfTheDay();
  return <SignupClient quote={q ? { text: q.text, by: q.by } : null} />;
}
