# Gift Card Manager

Manage Flipkart GCs, Amazon Pay & Amazon Shopping Vouchers — store, track balances, import/export CSV, auto-check Flipkart balances. Data stored in Supabase, accessible from any device.

## Features

- **Multi-provider** — Flipkart GC, Amazon Pay Voucher, Amazon Shopping Voucher
- **Dashboard** — Per-type balance breakdown, status tiles with click-to-filter
- **Auto Balance Check** — Flipkart GCs checked via Rome API with session cookies
- **Session Manager** — Add/remove Flipkart sessions from within the app
- **Bulk Import/Export** — CSV with card type support
- **Search & Filter** — By type, status, keyword
- **Cloud Storage** — Supabase Postgres, works from any device
- **Deploy to Vercel** — Free hosting with zero config

## Quick Start (Local Dev)

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Setup Supabase

1. Go to [supabase.com](https://supabase.com) and create a project (or use existing)
2. Open **SQL Editor** and run the contents of `supabase/migration.sql`
3. Go to **Settings → API** and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Service Role Key → `SUPABASE_SERVICE_ROLE_KEY`
4. Paste into `.env.local`

## Deploy to Vercel

### Option 1: GitHub + Vercel Dashboard

```bash
git add .
git commit -m "ready for deploy"
git push origin main
```

Then go to [vercel.com/new](https://vercel.com/new), import the repo, add env vars, deploy.

### Option 2: Vercel CLI

```bash
npm i -g vercel
vercel
```

Add environment variables when prompted or via Vercel dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Balance Checks Run On A Home Machine

Flipkart answers home internet connections but returns HTTP 529 to cloud hosts,
so the deployed site cannot call Flipkart itself. Instead it queues the check in
Supabase and a script on a home machine picks it up:

```bash
npm run home-checker
```

Leave that window open. It polls Supabase, calls Flipkart over your home
connection, and writes balances back. Because it only makes outbound requests,
you need no tunnel, no open port, and no extra software.

With it running, the refresh button works from any device, including a phone on
mobile data. With it stopped, the site still shows stored balances and tells you
to start the checker when you try to refresh.

## Adding Flipkart Sessions

1. Install **Cookie-Editor** browser extension
2. Log in to flipkart.com
3. Click Cookie-Editor → Export → JSON
4. In the app, click the session indicator (top-right) → Paste JSON → Add

Sessions last 7-14 days. Add multiple accounts for redundancy.

## Tech Stack

- **Next.js 16** (App Router, Turbopack)
- **TypeScript**
- **Tailwind CSS v4**
- **Supabase** (Postgres)
- **Vercel** (hosting)
