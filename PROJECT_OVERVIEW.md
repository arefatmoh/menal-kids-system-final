## Menal Kids System – Project Overview (Phase 1)

This is the single, consolidated overview for Phase 1. It replaces various scattered overview docs.

### Tech stack
- **Frontend/Server**: Next.js 14 (App Router), React 18, TypeScript, TailwindCSS
- **Database**: PostgreSQL 12+
- **Auth**: JWT-based (with login, refresh, logout)

### Deployment
- App:
  - `npm install`
  - `npm run build`
  - `npm run start`
- Database (choose OS):
  - Windows: `database/deploy-database.bat`
  - Linux/Mac: `database/deploy-database.sh`
  - Details: see `database/DEPLOYMENT_README.md`

Environment variables (example):
```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=menal_kids_shop
# Or use DATABASE_URL
```

### Core features
- **Products**: Uniform and variation types (color, size, price)
- **Inventory**: Per-branch tracking; stock movements (in, out, transfer, adjustment)
- **Sales**: Create sales with items; automatic inventory updates
- **Transfers**: Inter-branch transfers with status tracking
- **Expenses/Budgets**: Expense recording, summaries
- **Alerts**: Low stock and system notifications
- **Reports**: Sales, expenses, and stock trends

### App structure (high level)
- `app/api/*`: API routes for auth, products, variations, inventory, sales, stock movements, transfers, expenses, reports, dashboard widgets
- `app/dashboard/*`: UI for selling, inventory, stock operations, transfers, expenses, reports, and admin dashboard
- `lib/*`: Database connection, auth utilities, shared helpers, types
- `components/*`: Reusable UI components and complex widgets
- `database/*`: Schema, functions, migrations, and deployment scripts

### Database overview (essentials)
- Core tables: `branches`, `users`, `categories`, `products`, `product_variations`, `inventory`, `sales`, `sale_items`, `stock_movements`, `transfers`, `transfer_items`, `budgets`, `expenses`, `alerts`
- Key views: `v_inventory_status`, `v_sales_summary`, `v_transfer_summary`, `mv_dashboard_stats`
- Functions: inventory updates, sales processing, transfer management, reporting utilities
- See `database/DEPLOYMENT_README.md` for verification queries and maintenance routines

### Authentication
- JWT-based login/refresh/logout endpoints under `app/api/auth/*`
- Server utilities for validating tokens and guarding endpoints

### Maintenance and operations
- Prefer database changes via consolidated SQL under `database/` (schema, functions, migrations)
- Use deployment scripts to apply schema and verify state
- Backup/restore with `pg_dump`/`psql` as described in `database/DEPLOYMENT_README.md`

### Troubleshooting (quick)
- Verify DB connectivity: `psql -h <host> -U <user> -c "SELECT 1;"`
- Re-run database deployment if schema drifts from expected
- Check server logs and API route responses under `app/api/*`

### Notes
- Historic ad-hoc scripts have been removed; see `SCRIPTS_OVERVIEW.md` for context
- This file supersedes previous overview/summary markdowns at the root


