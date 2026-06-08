# Dealer AI OS — 23 Motorsports

Phase 1 MVP demo for independent dealership inventory management with AI-powered pricing and entry.

**Buy Better. Price Smarter. Sell Faster.**

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (Postgres + Auth)
- OpenAI API (gpt-4o)
- shadcn/ui components

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Open the SQL Editor and run `supabase/seed.sql` to create tables and load demo data
3. Copy your project URL and anon key

### 3. Configure environment variables

Copy `.env.local.example` to `.env.local` and fill in your keys:

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to the dashboard.

## Pages

| Route | Description |
|-------|-------------|
| `/dashboard` | KPIs, priority summary, daily action board |
| `/inventory` | Full inventory table with add/import |
| `/inventory/[id]` | Vehicle detail, comps, AI summary |
| `/ai-entry` | Natural language vehicle entry via OpenAI |

## CSV Import Format

Expected columns (header row required):

```
year,make,model,mileage,vin,my_cost,repair_cost,retail_price,listed_online,online_channel,status,bought_date,notes
```

## AI Priority Logic

- **LIST NOW** — not listed online
- **PRICE DROP** — listed 45+ days
- **AUCTION** — in stock 90+ days
- **HOLD** — everything else

## Demo Seed Data

5 vehicles pre-loaded for 23 Motorsports including Subaru Legacy, BMW M3, Audi S3, Ford F250, and Big Trex Trailer.
