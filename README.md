# PLUSS CRM

Agency sales CRM built with React, Vite, TypeScript, Tailwind CSS, and **Supabase**.

## Features

- **Auth & RBAC** — Admin vs Sales Rep roles with row-level security
- **Dashboard** — Company-wide (admin) or personal (rep) KPIs and charts
- **Leads** — Card view, CSV import, split rules, assignment queue (admin)
- **Pipeline** — Kanban deal stages with won/lost automation
- **Clients** — Profiles, notes, file uploads
- **Activities** — Calls, meetings, tasks with gamification points
- **Payments & Accounting** — Revenue tracking, P&L, exports (admin)
- **Team & Leaderboard** — Rep management, commissions, rankings
- **Settings** — Platform config (admin), profile & password (all)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` (already configured with your Supabase project):

```env
VITE_SUPABASE_URL=https://lnptkgvuyosabvoqivyg.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

### 3. Run database migrations

Open **Supabase Dashboard → SQL Editor** and run **in order**:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_fix_signup_trigger.sql` ← **required** (fixes "Database error creating new user")
3. `supabase/migrations/003_fix_analytics_rpcs.sql` ← fixes dashboard/leaderboard 400 errors
4. `supabase/migrations/004_dashboard_improvements.sql` ← dashboard RPC improvements

Then run `supabase/seed.sql` for compensation plans and sample data.
After `npm run seed:users`, run `supabase/seed-dashboard.sql` for dashboard demo charts.

### 4. Create demo users (fixes "Invalid login credentials")

Add your **secret / service_role** key to `.env` (not a `VITE_` variable):

```env
SUPABASE_SERVICE_ROLE_KEY=your_key_from_supabase_dashboard
```

Find it under **Project Settings → API Keys** (Legacy `service_role` or new `sb_secret_...`).

Then run:

```bash
npm run seed:users
```

This creates:

| Email | Password | Role |
|-------|----------|------|
| admin@pluss.agency | Admin123! | admin |
| rep@pluss.agency | Rep123! | sales_rep |

**Manual alternative:** create the same users in **Authentication → Users** with **Auto Confirm** enabled, then run `supabase/seed.sql`.

### 5. Create storage buckets

In **Storage**, create private buckets:

- `csv-imports`
- `client-files`

### 6. Start dev server

```bash
npm run dev
```

Open http://localhost:5173 and sign in with demo accounts.

## Role permissions

| Feature | Admin | Sales Rep |
|---------|-------|-----------|
| All leads & deals | Yes | Own only |
| CSV import / split rules / queue | Yes | No |
| Accounting / Team | Yes | Hidden |
| Dashboard | Company-wide | Personal |
| Leaderboard | Yes | Yes |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Type-check and production build |
| `npm run preview` | Preview production build |

## Stack

- React 19 + Vite 6 + TypeScript
- Supabase (Auth, PostgreSQL, RLS, Storage, Edge Functions)
- TanStack Query + Wouter + Recharts + shadcn/ui
