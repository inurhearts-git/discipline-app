// Turns Supabase auth errors into plain, actionable messages.
export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "That email and password don't match. Check them and try again.";
  if (m.includes("email not confirmed")) return "Confirm your email first. Open the link we sent you, then sign in.";
  if (m.includes("already registered") || m.includes("already been registered")) return "An account with this email already exists. Sign in instead.";
  if (m.includes("password should be at least")) return "Use a password of at least 6 characters.";
  if (m.includes("unable to validate email") || m.includes("invalid email")) return "Enter a valid email address.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Wait a minute, then try again.";
  if (m.includes("same password") || m.includes("different from the old")) return "Choose a password different from your current one.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Can't reach the server. Check your connection and try again.";
  return message;
}
