# Backups (backlog item 3f)

Supabase's free plan keeps only limited backups, so once a month you make your own: one encrypted file with every app table (profiles, content, journals, reflections, collections, deleted-account archives) and the sign-in accounts (emails and password hashes).

**Keep in mind:** the file holds people's private journals. It is encrypted with your password, but treat it like the database itself. Never put it in this GitHub repository (the repo is public; `*.tar.enc` is in `.gitignore` as a safety net).

## One-time setup

1. **Install the tools on your computer.** You need `pg_dump`, `pg_restore`, `psql` (PostgreSQL client tools) and `openssl`.
   - Mac: `brew install postgresql@17` (or the version matching your project, see below). `openssl` is already there.
   - Windows: use WSL (Ubuntu) and `sudo apt install postgresql-client`.
   - The client version must be the **same or newer** than your Supabase Postgres version. Find it in Supabase > Project Settings > Infrastructure (Postgres 15 or 17). Check yours with `pg_dump --version`.
2. **Get the connection string.** Supabase > Connect (top of the project) > Connection string > **Session pooler**. It looks like `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`. Put your database password in place of `[YOUR-PASSWORD]`. If you don't know it, reset it under Project Settings > Database.
3. **Pick where backups live.** Two places is best: a private cloud folder (iCloud, Google Drive, OneDrive) and an offline USB drive. Not email, not the repo.
4. **Pick a backup password** and store it in your password manager, separate from the files. Without it a backup can't be opened.

## Every month (about 5 minutes)

From the project folder on your computer:

```bash
export SUPABASE_DB_URL='postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres'
scripts/backup.sh ~/discipline-backups
```

It asks for the backup password, then prints the file name, size and a SHA-256 checksum. Copy the file to your two places. Keep the last 12 months, then delete older ones.

## Restore test (once now, then once or twice a year)

A backup you have never restored is a guess. Test it in a **scratch** Supabase project, never the live one.

1. Create a new free Supabase project, for example `discipline-restore-test`. Leave it empty: don't run any migrations.
2. Copy its Session pooler connection string (step 2 above).
3. Run:
   ```bash
   export TARGET_DB_URL='postgresql://postgres.<scratch-ref>:<password>@...:5432/postgres'
   export LIVE_PROJECT_REF='<your live project ref>'   # makes the script refuse the live project
   scripts/restore.sh ~/discipline-backups/discipline-backup-YYYY-MM-DD.tar.enc
   ```
4. It prints row counts (accounts, profiles, content, journal entries, reflections). Compare with the live project (Table Editor shows counts). They should match the day of the backup.
5. Delete the scratch project (Project Settings > General > Delete project).

The script refuses a target that already has tables, and says so if the password is wrong.

## What is not in the backup

- **Uploaded music files** (Storage > `music` bucket). Keep your own copy of the MP3s; they rarely change.
- **Settings in Vercel and Supabase** (API keys, `ACCOUNT_ARCHIVE_KEY`, cron secret, auth settings). Keep `ACCOUNT_ARCHIVE_KEY` in your password manager: without it, the deleted-account archives in a backup can't be read.
- **Code**: that is in GitHub.

## Restoring for real (if the live project is lost)

Restore into a new project as in the test, run any migrations newer than the backup, then point Vercel at the new project (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) and redeploy. People keep their accounts and passwords (the backup holds password hashes, never the passwords themselves). If anyone can't sign in, "Forgot password" resets it.
