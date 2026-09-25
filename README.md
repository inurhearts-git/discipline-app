# Discipline

A real, multi-user version of the `motivation-feed.jsx` artifact, built per
`discipline-app-blueprint.md`. This scaffold implements **sections 2–5**:

- **§2 Architecture** — Next.js (App Router) + Supabase (Postgres, Auth), deployable to Vercel.
- **§3 Data model** — full schema in `supabase/migrations/0001_init.sql`: `profiles`, `content_items`, `people`, `audio_tracks`, `user_content_interactions`, `usage_sessions`, with row-level security.
- **§5 Usage cap** — server-authoritative, via `POST /api/usage/heartbeat`. The client never reports "time spent," only a fixed delta per tick, and the server clamps and stores it — see `lib/supabase/admin.ts` for why this can't be bypassed by editing client state.

Not yet wired up (blueprint §6–10 — later steps): YouTube search API, background music matching, view counters, age gating, shareable cards, weekly recap. The schema already has room for these (`people`, `audio_tracks`, `maturity_rating`, `view_count` columns exist and are ready).

## Visual design

Ported from `motivation-feed.jsx` 1:1: the ink/parchment/brass palette, Newsreader/Space Grotesk type pairing, and the tick-rail progress indicator live in `lib/constants.ts` and `components/ui/Shell.tsx`. Every screen (`login`, `signup`, `onboarding`, `feed`, `profile`, `submit`, `moderate`, `limit`) reuses the same `Shell` wrapper so the app keeps the "single phone-width card" look from the prototype.

## What changed vs. the prototype (and why)

| Prototype | This scaffold | Why |
|---|---|---|
| Name-only login, self-declared role | Real Supabase Auth (email/password); signup only offers viewer/creator | Blueprint §6: admin must never be self-service |
| Admin approval = client write to shared storage | `/api/moderate/[id]` re-checks `profiles.role` server-side, then writes with a service-role client | No client write policy exists on `content_items` at all — approval is impossible without going through this route |
| Usage tracked in local component state | `/api/usage/heartbeat` accumulates `ms_spent` server-side, delta clamped per call | Closes the "edit browser state to bypass the cap" gap described in blueprint §5 |
| Flat JSON in shared storage | Real relational schema with RLS | Multi-user, and each table's access is scoped by policy instead of by convention |

## Setup

1. **Create a Supabase project** at supabase.com.
2. **Run the migration**: paste `supabase/migrations/0001_init.sql` into the Supabase SQL editor (or `supabase db push` if you're using the CLI), and run it.
3. **Copy env vars**: `cp .env.local.example .env.local` and fill in your project URL, anon key, and service role key (Project Settings → API in the Supabase dashboard).
4. **Install and run**:
   ```bash
   npm install
   npm run dev
   ```
5. Visit `http://localhost:3000`, sign up, and you'll land in onboarding → feed.

### First admin

No one can sign up as admin (by design). To promote your first admin, run this once in the Supabase SQL editor after that person has signed up:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

This bypasses the app's own trigger (`prevent_self_role_escalation`) because it's run with the Postgres superuser, not through PostgREST — that trigger only blocks *client* requests from doing this.

### Seed content

Once you have an admin, seed the feed with the prototype's example content:

```bash
psql "$DATABASE_URL" -v admin_id="'<your-admin-profile-id>'" -f supabase/seed.sql
```

(Or paste the SQL directly into the Supabase SQL editor with the `:admin_id` placeholders replaced by your admin's UUID in quotes.)

## Project layout

```
app/
  login/, signup/          real auth
  onboarding/               pick feed categories
  feed/                     the swipe feed (server page + FeedClient)
  profile/                  usage, preferences, role-gated links
  submit/                   creator/admin content submission
  moderate/                 admin-only approve/reject queue
  limit/                    shown once the daily cap is hit
  api/
    usage/heartbeat/        POST: server-authoritative usage accumulation
    content/                GET approved feed, POST new submission
    content/[id]/interact/  like/save toggle
    moderate/[id]/          POST approve/reject, admin-verified server-side
    profile/                GET/PATCH own profile
lib/
  supabase/client.ts        browser client (RLS applies)
  supabase/server.ts        server client for Server Components/Route Handlers (RLS applies)
  supabase/admin.ts         service-role client — bypasses RLS, server-only, used only after manual auth checks
  constants.ts               ported design tokens (COLORS, CATEGORIES, DAILY_LIMIT_MS)
  database.types.ts          hand-written types matching the schema
components/
  ui/Shell.tsx, Btn.tsx      ported visual primitives
  feed/FeedClient.tsx        ported FeedScreen
  profile/ProfileClient.tsx, ModerateClient.tsx
supabase/
  migrations/0001_init.sql   full schema + RLS
  seed.sql                   prototype's SEED_CONTENT, as SQL
```

## Build sequence (from the blueprint, §11)

This scaffold is steps 1–6. Steps 7–11 (YouTube search, view counter, age gating, music matching, Gen-Z layer) are unimplemented but the schema already has the columns/tables they need.
