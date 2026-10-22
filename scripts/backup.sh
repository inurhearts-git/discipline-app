#!/usr/bin/env bash
# Monthly backup of the Discipline database (backlog item 3f).
#
#   SUPABASE_DB_URL='postgresql://...' scripts/backup.sh [output-folder]
#
# Makes ONE encrypted file, discipline-backup-YYYY-MM-DD.tar.enc, holding:
#   - auth_users.dump : sign-in accounts and their email identities (data only,
#                       including password hashes), so people can sign in again
#   - public.dump     : every app table, schema and data (profiles, content,
#                       journals, reflections, collections, archives, ...)
# It asks for a password (or reads BACKUP_PASSWORD) and encrypts with AES-256 (openssl, PBKDF2). Nothing
# is written unencrypted except in a private temporary folder that is wiped.
# Keep the password somewhere other than the backup file.
#
# Needs pg_dump 15 or newer matching your Supabase Postgres version, and
# openssl. See docs/BACKUPS.md for where to get SUPABASE_DB_URL.
set -euo pipefail

: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL to your database connection string (see docs/BACKUPS.md).}"
command -v pg_dump >/dev/null || { echo "pg_dump not found. Install the PostgreSQL client tools." >&2; exit 1; }
command -v openssl >/dev/null || { echo "openssl not found." >&2; exit 1; }

out_dir="${1:-$HOME/discipline-backups}"
mkdir -p "$out_dir"
stamp="$(date -u +%Y-%m-%d)"
out="$out_dir/discipline-backup-$stamp.tar.enc"

work="$(mktemp -d)"
chmod 700 "$work"
cleanup() { find "$work" -type f -exec sh -c 'command -v shred >/dev/null && shred -u "$1" || rm -f "$1"' _ {} \; ; rm -rf "$work"; }
trap cleanup EXIT

echo "Dumping sign-in accounts (auth.users, auth.identities)..."
pg_dump "$SUPABASE_DB_URL" --data-only --table=auth.users --table=auth.identities --no-owner --no-privileges --format=custom -f "$work/auth_users.dump"
echo "Dumping app tables (public schema)..."
pg_dump "$SUPABASE_DB_URL" --schema=public --no-owner --no-privileges --format=custom -f "$work/public.dump"

{
  echo "Discipline backup $stamp (UTC)"
  echo "pg_dump: $(pg_dump --version)"
  pg_restore --list "$work/public.dump" | grep -c "TABLE DATA" | sed 's/^/public tables with data: /'
} > "$work/README.txt"

tar -C "$work" -cf "$work/backup.tar" auth_users.dump public.dump README.txt
pass_opt=()
if [ -n "${BACKUP_PASSWORD:-}" ]; then pass_opt=(-pass env:BACKUP_PASSWORD); else echo "Choose a password for this backup (you will need it to restore):"; fi
openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt "${pass_opt[@]}" -in "$work/backup.tar" -out "$out"

if command -v sha256sum >/dev/null; then sum=$(sha256sum "$out" | cut -d' ' -f1); else sum=$(shasum -a 256 "$out" | cut -d' ' -f1); fi
echo
echo "Saved: $out ($(du -h "$out" | cut -f1))"
echo "SHA-256: $sum"
echo "Store it somewhere safe (not in the GitHub repo) and keep the password separately."
