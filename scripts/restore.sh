#!/usr/bin/env bash
# Restore a Discipline backup into an EMPTY database (backlog item 3f).
#
#   TARGET_DB_URL='postgresql://...' scripts/restore.sh discipline-backup-YYYY-MM-DD.tar.enc
#
# Use a scratch Supabase project for the restore test, never the live one.
# Loads sign-in accounts first, then every app table, then prints row counts
# so you can compare them with the live site.
set -euo pipefail

file="${1:?Pass the .tar.enc backup file.}"
: "${TARGET_DB_URL:?Set TARGET_DB_URL to the EMPTY database to restore into.}"
case "$TARGET_DB_URL" in *"${LIVE_PROJECT_REF:-__none__}"*) echo "That looks like the live project. Stopping." >&2; exit 1;; esac

work="$(mktemp -d)"
chmod 700 "$work"
trap 'rm -rf "$work"' EXIT

pass_opt=()
if [ -n "${BACKUP_PASSWORD:-}" ]; then pass_opt=(-pass env:BACKUP_PASSWORD); else echo "Backup password:"; fi
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 "${pass_opt[@]}" -in "$file" -out "$work/backup.tar" 2>/dev/null \
  || { echo "Couldn't decrypt: wrong password, or the file is damaged." >&2; exit 1; }
tar -C "$work" -xf "$work/backup.tar"
cat "$work/README.txt"

if [ "$(psql "$TARGET_DB_URL" -Atc "select count(*) from information_schema.tables where table_schema='public'")" != "0" ]; then
  echo "The target already has tables in public. Use an empty project." >&2
  exit 1
fi

echo "Restoring sign-in accounts..."
pg_restore --data-only --no-owner --no-privileges -d "$TARGET_DB_URL" "$work/auth_users.dump"
echo "Restoring app tables..."
# Every database already has a "public" schema, so skip creating it.
pg_restore --list "$work/public.dump" | grep -v -E "^[0-9]+; [0-9]+ [0-9]+ SCHEMA - public " > "$work/restore.list"
pg_restore --no-owner --no-privileges --exit-on-error --use-list="$work/restore.list" -d "$TARGET_DB_URL" "$work/public.dump"

# The sign-up trigger lives on auth.users, so the public dump doesn't carry it.
psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -qc "drop trigger if exists trg_handle_new_user on auth.users; create trigger trg_handle_new_user after insert on auth.users for each row execute function public.handle_new_user();"

echo
echo "Row counts in the restored copy:"
psql "$TARGET_DB_URL" -At -F ' : ' -c "
  select 'auth.users', count(*) from auth.users
  union all select 'profiles', count(*) from public.profiles
  union all select 'content_items', count(*) from public.content_items
  union all select 'journal_entries', count(*) from public.journal_entries
  union all select 'reflections', count(*) from public.reflections"
echo "Done. Compare these with the live project, then delete the scratch project."
