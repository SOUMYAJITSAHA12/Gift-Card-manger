-- Gift Card Manager: Supabase Schema
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- Cards table
CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_type TEXT NOT NULL DEFAULT 'flipkart',
  card_number TEXT NOT NULL UNIQUE,
  pin TEXT NOT NULL DEFAULT '',
  balance NUMERIC,
  initial_amount NUMERIC,
  label TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  expiry_date DATE,
  status TEXT NOT NULL DEFAULT 'unknown',
  last_checked TIMESTAMPTZ,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sessions table (Flipkart auth cookies)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT '',
  cookies JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status);
CREATE INDEX IF NOT EXISTS idx_cards_card_type ON cards(card_type);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(is_active);
