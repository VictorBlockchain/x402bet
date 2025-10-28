BEGIN;

-- 1) Drop old composite unique constraint
ALTER TABLE x402_markets
  DROP CONSTRAINT IF EXISTS x402_markets_sport_key_event_id_market_type_key;

-- 2) Add new columns (idempotent)
ALTER TABLE x402_markets
  ADD COLUMN IF NOT EXISTS event_id TEXT,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS market_address TEXT,
  ADD COLUMN IF NOT EXISTS factory TEXT,
  ADD COLUMN IF NOT EXISTS creator TEXT,
  ADD COLUMN IF NOT EXISTS contract_event_id BIGINT,
  ADD COLUMN IF NOT EXISTS home_team TEXT,
  ADD COLUMN IF NOT EXISTS away_team TEXT,
  ADD COLUMN IF NOT EXISTS is_open BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS cancelled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS settled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_push BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS in_dispute BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fee_bps SMALLINT,
  ADD COLUMN IF NOT EXISTS fee_recipient TEXT,
  ADD COLUMN IF NOT EXISTS token_type TEXT,
  ADD COLUMN IF NOT EXISTS token TEXT,
  ADD COLUMN IF NOT EXISTS winning_selection SMALLINT,
  ADD COLUMN IF NOT EXISTS payout_multiplier NUMERIC(39, 0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_pool NUMERIC(78, 0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS settlement_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS home_selection_id SMALLINT,
  ADD COLUMN IF NOT EXISTS away_selection_id SMALLINT,
  ADD COLUMN IF NOT EXISTS spread_tenths SMALLINT,
  ADD COLUMN IF NOT EXISTS spread_applies_to_home BOOLEAN,
  ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cutoff_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS min_bet NUMERIC(78, 0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_bet NUMERIC(78, 0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS oracle TEXT,
  ADD COLUMN IF NOT EXISTS home_score_final SMALLINT,
  ADD COLUMN IF NOT EXISTS away_score_final SMALLINT,
  ADD COLUMN IF NOT EXISTS scores_set BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS home_pool NUMERIC(78, 0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS away_pool NUMERIC(78, 0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_pool NUMERIC(78, 0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS home_bet_count BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS away_bet_count BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_onchain_sync TIMESTAMPTZ;

-- 3) Add token_type CHECK constraint (safe pattern)
ALTER TABLE x402_markets
  ADD CONSTRAINT x402_markets_token_type_check
  CHECK (token_type IN ('native', 'erc20')) NOT VALID;

ALTER TABLE x402_markets
  VALIDATE CONSTRAINT x402_markets_token_type_check;

-- 4) Enforce uniqueness on market_address (via unique index)
CREATE UNIQUE INDEX IF NOT EXISTS x402_markets_market_address_key
  ON x402_markets (market_address);

-- 5) Supporting indexes
CREATE INDEX IF NOT EXISTS idx_markets_slug ON x402_markets(slug);
CREATE INDEX IF NOT EXISTS idx_markets_event_id ON x402_markets(event_id);
CREATE INDEX IF NOT EXISTS idx_markets_home_team ON x402_markets(home_team);
CREATE INDEX IF NOT EXISTS idx_markets_away_team ON x402_markets(away_team);
CREATE INDEX IF NOT EXISTS idx_markets_contract_event_id ON x402_markets(contract_event_id);
CREATE INDEX IF NOT EXISTS idx_markets_creator ON x402_markets(creator);

-- 6) Optional backfill for existing rows
UPDATE x402_markets
SET
  is_open = COALESCE(is_open, TRUE),
  cancelled = COALESCE(cancelled, FALSE),
  settled = COALESCE(settled, FALSE),
  is_push = COALESCE(is_push, FALSE),
  in_dispute = COALESCE(in_dispute, FALSE),
  scores_set = COALESCE(scores_set, FALSE),
  payout_multiplier = COALESCE(payout_multiplier, 0),
  bonus_pool = COALESCE(bonus_pool, 0),
  home_pool = COALESCE(home_pool, 0),
  away_pool = COALESCE(away_pool, 0),
  total_pool = COALESCE(total_pool, 0),
  home_bet_count = COALESCE(home_bet_count, 0),
  away_bet_count = COALESCE(away_bet_count, 0);

COMMIT;