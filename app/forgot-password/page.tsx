import { getPublicQuoteOfTheDay } from "@/lib/qotd-public";
import { ForgotPasswordClient } from "./ForgotPasswordClient";

// Rendered per request so the stage always shows today's quote of the day.
export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  const q = await getPublicQuoteOfTheDay();
  return <ForgotPasswordClient quote={q ? { text: q.text, by: q.by } : null} />;
}
