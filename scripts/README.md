# Scripts directory (reference only)

This folder is intentionally minimal. Phase 1 deployment does not use files here.

- Database deployment: see `database/deploy-database.(bat|sh)`
- App build/start: `npm run build`, `npm run start`

For a full summary of the old scripts and why they were removed, see `SCRIPTS_OVERVIEW.md` at the repository root.

If you add a one-off maintenance script in the future, prefer using environment variables for DB connection and remove the file after use.
