# Dealer AI OS — 23 Motorsports

Phase 1 MVP for independent dealership operations: inventory management, AI-assisted pricing, Facebook Marketplace research, listing publish, and Messenger integration.

**Buy Better. Price Smarter. Sell Faster.**

---

## What This Application Does

| Module | Route | Description |
|--------|-------|-------------|
| **Dashboard** | `/dashboard` | KPIs, priority summary, daily action board |
| **Inventory** | `/inventory` | Vehicle list, add/edit, CSV import, photos |
| **Vehicle Detail** | `/inventory/[id]` | Pricing, market comps, AI summary, FB publish |
| **Market Search** | `/market-search` | Scrape Facebook Marketplace comps via Multilogin |
| **Logic Engine** | `/logic-engine` | Configurable pricing / action rules with AI |
| **Messenger** | `/messenger` | Facebook Page Messenger inbox (Graph API) |
| **AI Entry** | `/ai-entry` | Natural-language vehicle entry via OpenAI |

---

## Tech Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** + **shadcn/ui**
- **Supabase** (PostgreSQL)
- **OpenAI API** (gpt-4o) — AI entry, logic engine, listing copy
- **Playwright** — Facebook Marketplace scraper & publisher
- **Multilogin X** — Anti-detect browser profiles for FB automation (runs locally)

---

## Project Structure

```
├── src/
│   ├── app/                    # Pages and API routes
│   │   ├── api/
│   │   │   ├── fb-scraper/     # Marketplace search (Multilogin + Playwright)
│   │   │   ├── fb-publisher/   # Publish listings to FB Marketplace
│   │   │   ├── fb-listing-generate/  # AI listing descriptions
│   │   │   ├── market-comps/   # Saved comp CRUD
│   │   │   ├── vehicles/       # Inventory CRUD, import, photo upload
│   │   │   ├── messenger/      # FB Messenger sync & send
│   │   │   ├── logic-engine/   # Rule evaluation
│   │   │   └── ai-extract/     # NL vehicle parsing
│   │   ├── dashboard/
│   │   ├── inventory/
│   │   ├── market-search/
│   │   ├── logic-engine/
│   │   ├── messenger/
│   │   └── ai-entry/
│   ├── components/             # UI components
│   └── lib/
│       ├── fb-scraper/         # Scraper, Multilogin, FB auth
│       ├── logic-engine/       # Rule evaluator
│       ├── messenger/          # Graph API client
│       └── supabase/           # DB clients
├── supabase/
│   ├── seed.sql                # Full schema + demo data (run first)
│   └── migrations/             # Additional schema changes
├── public/
│   └── uploads/vehicles/       # Local photo fallback (.gitkeep only in repo)
├── .env.local.example          # Environment variable template
└── package.json
```

---

## Prerequisites

- **Node.js 18+** and npm
- **Supabase** account (free tier works for development)
- **OpenAI API key** (for AI Entry, Logic Engine, listing generation)
- **Multilogin X** desktop app (required for Market Search & FB Publisher)
- **Facebook account** logged into the Multilogin profile (for scraping/publishing)
- **Facebook Page** + Graph API token (optional, for Messenger module)

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

Playwright browsers are installed automatically as a dependency of the `playwright` package. If scraping fails with a browser error, run:

```bash
npx playwright install chromium
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run the full contents of `supabase/seed.sql`.
3. Run migrations in order (if not already applied):
   - `supabase/migrations/20250630_add_vehicle_image_url.sql`
   - `supabase/migrations/20250630_add_vehicle_image_urls.sql`
4. Copy your **Project URL** and **anon key** from Project Settings → API.

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local` (see [Environment Variables](#environment-variables) below).

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you will be redirected to the dashboard.

### 5. Production build

```bash
npm run build
npm start
```

---

## Environment Variables

Copy `.env.local.example` to `.env.local` and configure:

### Required (core app)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `OPENAI_API_KEY` | OpenAI API key for AI features |

### Recommended

| Variable | Description |
|----------|-------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Enables auto-creation of Supabase Storage bucket for vehicle photos |

### Facebook Marketplace Scraper & Publisher

Requires **Multilogin X** running on the **same machine** as the Next.js server (port `45000`).

| Variable | Description |
|----------|-------------|
| `MULTILOGIN_EMAIL` | Multilogin account email |
| `MULTILOGIN_PASSWORD` | Multilogin account password |
| `MULTILOGIN_FOLDER_ID` | Folder ID containing the FB profile |
| `MULTILOGIN_PROFILE_ID` | Browser profile ID (must be logged into Facebook) |
| `MULTILOGIN_LAUNCHER_URL` | Optional; default `http://127.0.0.1:45000` |
| `FB_EMAIL` | Facebook login email (reference / fallback) |
| `FB_PASSWORD` | Facebook login password (reference / fallback) |
| `FB_COOKIES` | Optional JSON cookie export for session injection |

> **Important:** Market Search and FB Publisher **do not work on Vercel/serverless** unless the server can reach a machine running Multilogin locally. Run those features on a local or VPS machine with Multilogin installed.

### Facebook Messenger (optional)

| Variable | Description |
|----------|-------------|
| `FB_PAGE_ACCESS_TOKEN` | Page access token with `pages_messaging` permission |
| `FB_PAGE_ID` | Facebook Page ID |

### Optional AI override

| Variable | Description |
|----------|-------------|
| `KIE_API_URL` | Custom OpenAI-compatible API base URL |

---

## Market Search (Facebook Comps)

Market Search launches a Multilogin browser profile, searches Facebook Marketplace, and returns comparable listings.

### Setup

1. Install and open **Multilogin X** on the same machine as the app.
2. Create a browser profile and log into Facebook / Marketplace manually once.
3. Copy `MULTILOGIN_FOLDER_ID` and `MULTILOGIN_PROFILE_ID` into `.env.local`.
4. Use **Market Search** from the sidebar or link from a vehicle detail page (`?vehicle_id=...`).

### Batch pagination

When searching the same keywords repeatedly, results can repeat. Use:

- **Result batch** — batch `0` = first N results; batch `2` with 25 results skips the first 50 listings.
- **Next results** — loads the next batch (enabled when more listings may exist).
- **Go to batch** — jump to a specific batch number.

Each batch triggers a full scrape (typically 1–3 minutes). Higher batch numbers take longer because the scraper scrolls past earlier listings.

### Troubleshooting

| Issue | Action |
|-------|--------|
| Multilogin not running | Start Multilogin X locally; confirm port 45000 |
| Profile already running | Click **Reset Browser Session** on Market Search, wait, retry |
| Login / 2FA required | Log into FB manually in the Multilogin profile |
| Blocked by Facebook | Wait and retry; reduce search frequency |

---

## CSV Import

Import vehicles from **Inventory → Import CSV**.

Required header row:

```
year,make,model,mileage,vin,my_cost,repair_cost,retail_price,listed_online,online_channel,status,bought_date,notes
```

---

## AI Priority Logic (default rules)

- **LIST NOW** — not listed online
- **PRICE DROP** — listed 45+ days
- **AUCTION** — in stock 90+ days
- **HOLD** — everything else

Custom rules can be configured on the **Logic Engine** page.

---

## Deployment Notes

### Vercel (inventory, dashboard, AI, messenger)

1. Push to GitHub and import in Vercel.
2. Set environment variables in Vercel project settings.
3. Deploy — core features work without Multilogin.

### Self-hosted / VPS (full features including FB scrape)

For Market Search and FB Publisher, deploy on a Windows or Linux machine where **Multilogin X** can run alongside the Node.js server:

```bash
npm run build
npm start
```

Or use PM2 / systemd to keep the process running.

---

## Demo Seed Data

Running `supabase/seed.sql` loads sample vehicles for **23 Motorsports** (Subaru Legacy, BMW M3, Audi S3, Ford F250, Big Trex Trailer) plus sample customers and messages.

---

## Files Not Included in Client Package

The delivery zip intentionally excludes:

| Excluded | Reason |
|----------|--------|
| `node_modules/` | Reinstall with `npm install` |
| `.next/` | Build output — run `npm run build` |
| `.env.local` | Secrets — use `.env.local.example` |
| `.git/` | Version history |
| `data/` | Local FB cookies and runtime data |
| `fb-*.png` | Debug screenshots from development |
| Uploaded vehicle photos | Client-specific media |

After extracting the zip, run `npm install` and create `.env.local` before starting.

---

## Support Checklist for New Developers

- [ ] Supabase project created; `seed.sql` + migrations applied
- [ ] `.env.local` filled from `.env.local.example`
- [ ] `npm install` && `npm run dev` succeeds
- [ ] Dashboard loads at `http://localhost:3000`
- [ ] Multilogin X running (for Market Search / FB Publisher)
- [ ] FB profile logged in inside Multilogin
- [ ] OpenAI key valid (for AI Entry / Logic Engine)

---

## License

Proprietary — delivered to client for 23 Motorsports / Dealer AI OS Phase 1 MVP.
