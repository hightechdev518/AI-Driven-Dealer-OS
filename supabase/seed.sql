-- Dealer AI OS - Database Schema & Seed Data
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  year INTEGER,
  make TEXT,
  model TEXT,
  mileage INTEGER,
  vin TEXT,
  my_cost NUMERIC(12, 2) DEFAULT 0,
  repair_cost NUMERIC(12, 2) DEFAULT 0,
  total_invested NUMERIC(12, 2) DEFAULT 0,
  retail_price NUMERIC(12, 2),
  auction_price NUMERIC(12, 2),
  gross_profit NUMERIC(12, 2),
  net_profit NUMERIC(12, 2),
  roi NUMERIC(8, 2),
  listed_online BOOLEAN DEFAULT FALSE,
  online_channel TEXT,
  status TEXT DEFAULT 'In Stock',
  bought_date DATE,
  days_in_stock INTEGER DEFAULT 0,
  market_low NUMERIC(12, 2),
  market_avg NUMERIC(12, 2),
  market_high NUMERIC(12, 2),
  comp_count INTEGER DEFAULT 0,
  ai_confidence NUMERIC(5, 2),
  ai_priority TEXT,
  recommended_price NUMERIC(12, 2),
  action_required TEXT,
  notes TEXT,
  fb_listing_url TEXT,
  fb_listed_at TIMESTAMPTZ,
  fb_listing_status TEXT CHECK (fb_listing_status IN ('draft', 'published', 'sold')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Market comps table
CREATE TABLE IF NOT EXISTS market_comps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  year INTEGER,
  make TEXT,
  model TEXT,
  mileage INTEGER,
  source TEXT,
  location TEXT,
  listing_price NUMERIC(12, 2),
  url TEXT,
  source_notes TEXT,
  date_checked DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT,
  phone TEXT,
  email TEXT,
  fb_profile_url TEXT,
  fb_messenger_id TEXT UNIQUE,
  fb_conversation_id TEXT,
  source TEXT DEFAULT 'messenger' CHECK (source IN ('messenger', 'manual')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  timestamp TIMESTAMPTZ NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  fb_message_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer vehicle inquiries
CREATE TABLE IF NOT EXISTS customer_inquiries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_ai_priority ON vehicles(ai_priority);
CREATE INDEX IF NOT EXISTS idx_market_comps_vehicle_id ON market_comps(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_messages_customer_id ON messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_messages_read ON messages(read);
CREATE INDEX IF NOT EXISTS idx_customers_fb_messenger_id ON customers(fb_messenger_id);
CREATE INDEX IF NOT EXISTS idx_customer_inquiries_customer_id ON customer_inquiries(customer_id);

-- Row Level Security (permissive for MVP demo)
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_comps ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to vehicles" ON vehicles
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to market_comps" ON market_comps
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to customers" ON customers
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to messages" ON messages
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to customer_inquiries" ON customer_inquiries
  FOR ALL USING (true) WITH CHECK (true);

-- Clear existing seed data (optional - comment out if you want to preserve data)
-- DELETE FROM market_comps;
-- DELETE FROM vehicles;

-- Seed 5 demo vehicles for 23 Motorsports
INSERT INTO vehicles (
  year, make, model, mileage, my_cost, repair_cost, total_invested,
  retail_price, gross_profit, net_profit, roi,
  listed_online, online_channel, status, bought_date, days_in_stock,
  market_low, market_avg, market_high, comp_count,
  ai_priority, recommended_price, action_required, notes
) VALUES
(
  2011, 'Subaru', 'Legacy', 179000, 1900, 0, 1900,
  3000, 1100, 1100, 57.89,
  TRUE, 'Facebook', 'In Stock', CURRENT_DATE - INTERVAL '76 days', 76,
  2800, 3200, 3800, 4,
  'PRICE DROP', 3040, 'Reduce price to move inventory faster',
  'Listed on Facebook Marketplace'
),
(
  2009, 'BMW', 'M3', 140000, 8000, 0, 8000,
  17000, 9000, 9000, 112.50,
  TRUE, 'Cars.com', 'In Stock', CURRENT_DATE - INTERVAL '22 days', 22,
  15000, 16500, 18500, 5,
  'HOLD', 17325, 'Monitor market — no action needed',
  'Clean title, performance package'
),
(
  2016, 'Audi', 'S3', 150000, 2500, 3000, 5500,
  9500, 4000, 4000, 72.73,
  TRUE, 'Autotrader', 'In Stock', CURRENT_DATE - INTERVAL '94 days', 94,
  8500, 9200, 10500, 3,
  'AUCTION', 9660, 'Consider auction — too long in stock',
  'Needs cosmetic touch-ups completed'
),
(
  2009, 'Ford', 'F250 Diesel', 195000, 11000, 0, 11000,
  18000, 7000, 7000, 63.64,
  FALSE, NULL, 'In Stock', CURRENT_DATE - INTERVAL '35 days', 35,
  16000, 17500, 19500, 2,
  'LIST NOW', 18000, 'List vehicle online immediately',
  'Powerstroke diesel, crew cab'
),
(
  2023, 'Big Trex', 'Trailer', NULL, 1700, 0, 1700,
  3200, 1500, 1500, 88.24,
  FALSE, NULL, 'In Stock', CURRENT_DATE - INTERVAL '114 days', 114,
  NULL, NULL, NULL, 0,
  'LIST NOW', 3200, 'List vehicle online immediately',
  'Utility trailer, not yet listed online'
);

-- Add sample market comps for BMW M3 (vehicle 2)
INSERT INTO market_comps (vehicle_id, year, make, model, mileage, source, location, listing_price, url, date_checked)
SELECT id, 2009, 'BMW', 'M3', 135000, 'Cars.com', 'Portland, OR', 16200, 'https://example.com/comp1', CURRENT_DATE
FROM vehicles WHERE make = 'BMW' AND model = 'M3' LIMIT 1;

INSERT INTO market_comps (vehicle_id, year, make, model, mileage, source, location, listing_price, url, date_checked)
SELECT id, 2009, 'BMW', 'M3', 148000, 'Autotrader', 'Seattle, WA', 16800, 'https://example.com/comp2', CURRENT_DATE
FROM vehicles WHERE make = 'BMW' AND model = 'M3' LIMIT 1;

INSERT INTO market_comps (vehicle_id, year, make, model, mileage, source, location, listing_price, url, date_checked)
SELECT id, 2010, 'BMW', 'M3', 142000, 'Facebook', 'Vancouver, WA', 15900, 'https://example.com/comp3', CURRENT_DATE
FROM vehicles WHERE make = 'BMW' AND model = 'M3' LIMIT 1;

INSERT INTO market_comps (vehicle_id, year, make, model, mileage, source, location, listing_price, url, date_checked)
SELECT id, 2009, 'BMW', 'M3', 155000, 'Cars.com', 'Beaverton, OR', 17100, 'https://example.com/comp4', CURRENT_DATE
FROM vehicles WHERE make = 'BMW' AND model = 'M3' LIMIT 1;

INSERT INTO market_comps (vehicle_id, year, make, model, mileage, source, location, listing_price, url, date_checked)
SELECT id, 2008, 'BMW', 'M3', 138000, 'Bring a Trailer', 'Online', 18500, 'https://example.com/comp5', CURRENT_DATE
FROM vehicles WHERE make = 'BMW' AND model = 'M3' LIMIT 1;

-- Add comps for Subaru Legacy
INSERT INTO market_comps (vehicle_id, year, make, model, mileage, source, location, listing_price, url, date_checked)
SELECT id, 2011, 'Subaru', 'Legacy', 175000, 'Facebook', 'Local', 2900, 'https://example.com/sub1', CURRENT_DATE
FROM vehicles WHERE make = 'Subaru' AND model = 'Legacy' LIMIT 1;

INSERT INTO market_comps (vehicle_id, year, make, model, mileage, source, location, listing_price, url, date_checked)
SELECT id, 2010, 'Subaru', 'Legacy', 182000, 'Craigslist', 'Local', 3100, 'https://example.com/sub2', CURRENT_DATE
FROM vehicles WHERE make = 'Subaru' AND model = 'Legacy' LIMIT 1;

INSERT INTO market_comps (vehicle_id, year, make, model, mileage, source, location, listing_price, url, date_checked)
SELECT id, 2012, 'Subaru', 'Legacy', 168000, 'Facebook', 'Local', 3400, 'https://example.com/sub3', CURRENT_DATE
FROM vehicles WHERE make = 'Subaru' AND model = 'Legacy' LIMIT 1;

INSERT INTO market_comps (vehicle_id, year, make, model, mileage, source, location, listing_price, url, date_checked)
SELECT id, 2011, 'Subaru', 'Legacy', 190000, 'Autotrader', 'Regional', 3200, 'https://example.com/sub4', CURRENT_DATE
FROM vehicles WHERE make = 'Subaru' AND model = 'Legacy' LIMIT 1;

-- Add comps for Audi S3
INSERT INTO market_comps (vehicle_id, year, make, model, mileage, source, location, listing_price, url, date_checked)
SELECT id, 2016, 'Audi', 'S3', 145000, 'Cars.com', 'Portland, OR', 8900, 'https://example.com/aud1', CURRENT_DATE
FROM vehicles WHERE make = 'Audi' AND model = 'S3' LIMIT 1;

INSERT INTO market_comps (vehicle_id, year, make, model, mileage, source, location, listing_price, url, date_checked)
SELECT id, 2015, 'Audi', 'S3', 152000, 'Autotrader', 'Seattle, WA', 9200, 'https://example.com/aud2', CURRENT_DATE
FROM vehicles WHERE make = 'Audi' AND model = 'S3' LIMIT 1;

INSERT INTO market_comps (vehicle_id, year, make, model, mileage, source, location, listing_price, url, date_checked)
SELECT id, 2016, 'Audi', 'S3', 158000, 'Facebook', 'Local', 9500, 'https://example.com/aud3', CURRENT_DATE
FROM vehicles WHERE make = 'Audi' AND model = 'S3' LIMIT 1;

-- Migration: add Facebook listing fields to existing databases
-- ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS fb_listing_url TEXT;
-- ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS fb_listed_at TIMESTAMPTZ;
-- ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS fb_listing_status TEXT CHECK (fb_listing_status IN ('draft', 'published', 'sold'));

-- Migration: add Messenger tables to existing databases
-- (run customers, messages, customer_inquiries CREATE TABLE statements above)

