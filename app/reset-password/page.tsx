import { getPublicQuoteOfTheDay } from "@/lib/qotd-public";
import { ResetPasswordClient } from "./ResetPasswordClient";

// Rendered per request so the stage always shows today's quote of the day.
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  const q = await getPublicQuoteOfTheDay();
  return <ResetPasswordClient quote={q ? { text: q.text, by: q.by } : null} />;
}
