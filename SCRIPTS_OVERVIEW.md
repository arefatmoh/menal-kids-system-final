## Scripts overview and cleanup

To finalize Phase 1 and simplify deployment, the ad‑hoc `scripts/` folder has been removed. Deployment and database setup are now consolidated under the `database/` directory and standard `npm` commands.

### How to deploy now
- Application
  - Install deps: `npm install`
  - Build: `npm run build`
  - Start: `npm run start`
- Database
  - Windows: run `database/deploy-database.bat`
  - Linux/Mac: run `database/deploy-database.sh`

These deployment scripts create the schema and functions and perform verification. No files from `scripts/` are required for deployment.

### What was removed (previous one‑off utilities)
The following categories of helper scripts were used during development and data fixes and are no longer needed for a clean deployment:

- One‑off database fixes and migrations
  - `apply-all-dashboard-fixes.js`, `apply-dashboard-enhancements.js`, `apply-final-dashboard-fix.js`, `apply-fix.js`
  - `fix-dashboard-schema-issues.js`, `fix-recent-activities-schema.js`, `enhance-recent-activities.js`, `fix-owner-sales-accuracy.js`
  - `fix-stock-duplication.js`, `fix-stock-duplication-final.js`, `fix_transfer_items_variation_id.js`, `fix-sku-trigger.js`
  - `comprehensive-database-fix.sql`, `run-comprehensive-fix.(bat|ps1|sh)`
- Local setup/reset helpers (dev only)
  - `setup-database.sh`, `setup-complete.sh`, `reset-database.(bat|sh)`, `reset_database.(bat|ps1)`
  - `migrate-database.sh`, `apply-variation-migration.bat`, `run-migration.js`
- SQL fragments from earlier iterations (now consolidated in deployment SQL)
  - `fix-variation-support.sql`, `add_variation_to_stock_movements.sql`, `update_low_stock_trigger.sql`
- Verification and test utilities (superseded by deployment verification)
  - `verify_database.js`, `verify-database-health.js`, `test-database.js`
- Miscellaneous
  - `clear-expired-tokens.js` (browser console helper)

All essential logic from these scripts has been incorporated into:
- `database/deployment-schema.sql`
- `database/deployment-functions.sql`
- `database/deploy-database.(bat|sh)`

### If you are migrating an existing database
For legacy environments that relied on the old fix scripts, refer to:
- `DATABASE_FIX_README.md`
- `DATABASE_FIXES_SUMMARY.md`
- `DATABASE_TRIGGER_FIX.md`

Prefer running the consolidated deployment SQL over re‑introducing old one‑off scripts.

### Rationale
- Reduce duplication and risk from ad‑hoc fixes
- Make deployment predictable and cross‑platform
- Keep only one source of truth for schema and functions


