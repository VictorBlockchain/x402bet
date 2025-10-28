BEGIN;

-- Add odds-related snapshot columns to x402_markets (idempotent)
ALTER TABLE x402_markets
  ADD COLUMN IF NOT EXISTS bookmaker_key TEXT,
  ADD COLUMN IF NOT EXISTS odds_format TEXT CHECK (odds_format IN ('american','decimal')),
  ADD COLUMN IF NOT EXISTS home_moneyline_price NUMERIC(10, 4),
  ADD COLUMN IF NOT EXISTS away_moneyline_price NUMERIC(10, 4),
  ADD COLUMN IF NOT EXISTS home_spread_point NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS home_spread_price NUMERIC(10, 4),
  ADD COLUMN IF NOT EXISTS away_spread_point NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS away_spread_price NUMERIC(10, 4),
  ADD COLUMN IF NOT EXISTS total_point NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS over_price NUMERIC(10, 4),
  ADD COLUMN IF NOT EXISTS under_price NUMERIC(10, 4);

-- Supporting index for bookmaker_key
CREATE INDEX IF NOT EXISTS idx_markets_bookmaker_key ON x402_markets(bookmaker_key);

COMMIT;