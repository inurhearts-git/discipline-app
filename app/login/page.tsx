import { getPublicQuoteOfTheDay } from "@/lib/qotd-public";
import { LoginClient } from "./LoginClient";

// Rendered per request so the stage always shows today's quote of the day.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const q = await getPublicQuoteOfTheDay();
  return <LoginClient quote={q ? { text: q.text, by: q.by } : null} />;
}
