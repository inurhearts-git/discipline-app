import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password", "/terms", "/privacy"];

// Unlike /login and /signup, /reset-password must stay reachable even for
// someone who already has a session -- clicking the emailed reset link
// creates a temporary "recovery" session, and we want them to land on the
// password form, not get redirected straight to /feed.
const NO_REDIRECT_IF_LOGGED_IN = ["/reset-password", "/terms", "/privacy"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));
  const skipLoggedInRedirect = NO_REDIRECT_IF_LOGGED_IN.some((p) => path.startsWith(p));

  // A deleted account (waiting out its restore window) can only see the
  // welcome-back choice and the legal pages until it restores or starts fresh.
  if (user?.app_metadata?.account_deleted === true) {
    const allowed = ["/welcome-back", "/terms", "/privacy"].some((p) => path.startsWith(p));
    if (!allowed) return NextResponse.redirect(new URL("/welcome-back", request.url));
    return response;
  }

  if (!user && !isPublic) {
    const redirectUrl = new URL("/login", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isPublic && !skipLoggedInRedirect) {
    return NextResponse.redirect(new URL("/feed", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Run on everything except static assets and API routes (API routes
    // check auth themselves so they can return JSON errors instead of
    // redirects).
    "/((?!_next/static|_next/image|favicon.ico|api).*)",
  ],
};
