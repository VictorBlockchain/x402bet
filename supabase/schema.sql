-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE x402_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  username TEXT UNIQUE,
  is_agent BOOLEAN DEFAULT FALSE,
  agent_config JSONB DEFAULT NULL,
  balance DECIMAL(18, 8) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bets table
CREATE TABLE x402_bets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES x402_users(id) ON DELETE CASCADE,
  sport_key TEXT NOT NULL,
  event_id TEXT NOT NULL,
  market_type TEXT NOT NULL CHECK (market_type IN ('h2h', 'spreads', 'totals')),
  selection TEXT NOT NULL,
  odds DECIMAL(10, 4) NOT NULL,
  odds_format TEXT DEFAULT 'american' CHECK (odds_format IN ('american', 'decimal')),
  stake DECIMAL(18, 8) NOT NULL,
  potential_payout DECIMAL(18, 8) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'cancelled', 'settled')),
  placed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  settled_at TIMESTAMP WITH TIME ZONE,
  settlement_hash TEXT,
  bookmaker TEXT NOT NULL,
  event_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Markets table for tracking volume and activity
CREATE TABLE x402_markets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Odds API linkage
  sport_key TEXT NOT NULL,
  event_id TEXT NOT NULL,
  slug TEXT,
  market_type TEXT NOT NULL,
  home_team TEXT,
  away_team TEXT,

  -- On-chain identifiers
  market_address TEXT UNIQUE,
  factory TEXT,
  creator TEXT,
  contract_event_id BIGINT,

  -- Core market state
  is_open BOOLEAN DEFAULT TRUE,
  cancelled BOOLEAN DEFAULT FALSE,
  settled BOOLEAN DEFAULT FALSE,
  is_push BOOLEAN DEFAULT FALSE,
  in_dispute BOOLEAN DEFAULT FALSE,

  -- Fees and token config
  fee_bps SMALLINT,
  fee_recipient TEXT,
  token_type TEXT CHECK (token_type IN ('native','erc20')),
  token TEXT,

  -- Settlement configuration and outcome
  winning_selection SMALLINT,
  payout_multiplier NUMERIC(39, 0) DEFAULT 0,
  bonus_pool NUMERIC(78, 0) DEFAULT 0,
  settlement_time TIMESTAMP WITH TIME ZONE,

  -- Proposition configuration
  home_selection_id SMALLINT,
  away_selection_id SMALLINT,
  spread_tenths SMALLINT,
  spread_applies_to_home BOOLEAN,
  start_time TIMESTAMP WITH TIME ZONE,
  cutoff_time TIMESTAMP WITH TIME ZONE,
  min_bet NUMERIC(78, 0) DEFAULT 0,
  max_bet NUMERIC(78, 0) DEFAULT 0,
  oracle TEXT,

  -- Odds fields (snapshots for display)
  bookmaker_key TEXT,
  odds_format TEXT CHECK (odds_format IN ('american','decimal')),
  home_moneyline_price NUMERIC(10, 4),
  away_moneyline_price NUMERIC(10, 4),
  home_spread_point NUMERIC(10, 2),
  home_spread_price NUMERIC(10, 4),
  away_spread_point NUMERIC(10, 2),
  away_spread_price NUMERIC(10, 4),
  total_point NUMERIC(10, 2),
  over_price NUMERIC(10, 4),
  under_price NUMERIC(10, 4),

  -- Final scores & pools
  home_score_final SMALLINT,
  away_score_final SMALLINT,
  scores_set BOOLEAN DEFAULT FALSE,
  home_pool NUMERIC(78, 0) DEFAULT 0,
  away_pool NUMERIC(78, 0) DEFAULT 0,
  total_pool NUMERIC(78, 0) DEFAULT 0,
  home_bet_count BIGINT DEFAULT 0,
  away_bet_count BIGINT DEFAULT 0,

  -- Activity & sync tracking
  total_volume DECIMAL(18, 8) DEFAULT 0,
  active_bets INTEGER DEFAULT 0,
  last_odds_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_onchain_sync TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Uniqueness: only the on-chain market_address should be unique
);

-- Settlements table for audit trail
CREATE TABLE x402_settlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bet_id UUID REFERENCES x402_bets(id) ON DELETE CASCADE,
  result TEXT NOT NULL CHECK (result IN ('won', 'lost')),
  payout_amount DECIMAL(18, 8) NOT NULL,
  settlement_source TEXT NOT NULL,
  settlement_data JSONB,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  transaction_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions table for wallet operations
CREATE TABLE x402_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES x402_users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'bet_stake', 'bet_payout', 'fee')),
  amount DECIMAL(18, 8) NOT NULL,
  balance_after DECIMAL(18, 8) NOT NULL,
  reference_id UUID, -- Can reference bet_id or other entities
  transaction_hash TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_bets_user_id ON x402_bets(user_id);
CREATE INDEX idx_bets_status ON x402_bets(status);
CREATE INDEX idx_bets_sport_event ON x402_bets(sport_key, event_id);
CREATE INDEX idx_bets_placed_at ON x402_bets(placed_at DESC);
CREATE INDEX idx_markets_sport_key ON x402_markets(sport_key);
CREATE INDEX idx_markets_slug ON x402_markets(slug);
CREATE INDEX idx_markets_bookmaker_key ON x402_markets(bookmaker_key);
CREATE INDEX idx_markets_market_address ON x402_markets(market_address);
CREATE INDEX idx_markets_event_id ON x402_markets(event_id);
CREATE INDEX idx_markets_home_team ON x402_markets(home_team);
CREATE INDEX idx_markets_away_team ON x402_markets(away_team);
CREATE INDEX idx_markets_contract_event_id ON x402_markets(contract_event_id);
CREATE INDEX idx_markets_creator ON x402_markets(creator);
CREATE INDEX idx_settlements_bet_id ON x402_settlements(bet_id);
CREATE INDEX idx_transactions_user_id ON x402_transactions(user_id);
CREATE INDEX idx_transactions_type ON x402_transactions(type);
CREATE INDEX idx_users_wallet_address ON x402_users(wallet_address);

-- Updated at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON x402_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bets_updated_at BEFORE UPDATE ON x402_bets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_markets_updated_at BEFORE UPDATE ON x402_markets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON x402_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE x402_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE x402_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE x402_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE x402_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE x402_transactions ENABLE ROW LEVEL SECURITY;

-- Profiles publicly readable; updates restricted to service role (server-side)
CREATE POLICY "Profiles publicly readable" ON x402_users
  FOR SELECT USING (true);

CREATE POLICY "Profiles updatable by service role" ON x402_users
  FOR UPDATE USING (auth.role() = 'service_role');

-- Bets publicly readable; inserts restricted to service role (server-side)
CREATE POLICY "Bets publicly readable" ON x402_bets
  FOR SELECT USING (true);

CREATE POLICY "Bets insert via service role" ON x402_bets
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Markets are publicly readable
CREATE POLICY "Markets are publicly readable" ON x402_markets
  FOR SELECT USING (true);

-- Settlements publicly readable
CREATE POLICY "Settlements publicly readable" ON x402_settlements
  FOR SELECT USING (true);

-- Odds ingestion tables (used by API routes)
-- Sports catalog from Odds API
CREATE TABLE IF NOT EXISTS x402_sports (
  sport_key TEXT PRIMARY KEY,
  group_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  in_season BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Events from Odds API
CREATE TABLE IF NOT EXISTS x402_events (
  id TEXT PRIMARY KEY,
  sport_key TEXT NOT NULL,
  commence_time TIMESTAMP WITH TIME ZONE,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  last_update TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bookmakers catalog
CREATE TABLE IF NOT EXISTS x402_bookmakers (
  key TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  last_seen TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Odds markets per event and bookmaker
CREATE TABLE IF NOT EXISTS x402_odds_markets (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT NOT NULL,
  bookmaker_key TEXT NOT NULL,
  market_type TEXT NOT NULL,
  last_update TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  link_url TEXT,
  source_market_id TEXT,
  bet_limit_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, bookmaker_key, market_type)
);

-- Odds outcomes attached to markets
CREATE TABLE IF NOT EXISTS x402_odds_outcomes (
  id BIGSERIAL PRIMARY KEY,
  odds_market_id BIGINT REFERENCES x402_odds_markets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price DECIMAL(10, 4),
  point DECIMAL(10, 2),
  side TEXT,
  source_outcome_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(odds_market_id, name, point)
);

-- Odds snapshots per bookmaker/market/event
CREATE TABLE IF NOT EXISTS x402_odds_snapshots (
  id BIGSERIAL PRIMARY KEY,
  as_of TIMESTAMP WITH TIME ZONE NOT NULL,
  sport_key TEXT NOT NULL,
  event_id TEXT NOT NULL,
  bookmaker_key TEXT NOT NULL,
  market_type TEXT NOT NULL,
  region TEXT,
  odds_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for ingestion tables
CREATE INDEX IF NOT EXISTS idx_events_sport_key ON x402_events(sport_key);
CREATE INDEX IF NOT EXISTS idx_events_commence_time ON x402_events(commence_time);
CREATE INDEX IF NOT EXISTS idx_odds_markets_event ON x402_odds_markets(event_id);
CREATE INDEX IF NOT EXISTS idx_odds_markets_bookmaker ON x402_odds_markets(bookmaker_key);
CREATE INDEX IF NOT EXISTS idx_odds_outcomes_market ON x402_odds_outcomes(odds_market_id);
CREATE INDEX IF NOT EXISTS idx_odds_snapshots_event ON x402_odds_snapshots(event_id);

-- Update triggers for ingestion tables
CREATE TRIGGER update_sports_updated_at BEFORE UPDATE ON x402_sports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON x402_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookmakers_updated_at BEFORE UPDATE ON x402_bookmakers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_odds_markets_updated_at BEFORE UPDATE ON x402_odds_markets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_odds_outcomes_updated_at BEFORE UPDATE ON x402_odds_outcomes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_odds_snapshots_updated_at BEFORE UPDATE ON x402_odds_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS enablement for ingestion tables
ALTER TABLE x402_sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE x402_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE x402_bookmakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE x402_odds_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE x402_odds_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE x402_odds_snapshots ENABLE ROW LEVEL SECURITY;

-- Public read policies; service role controls writes
CREATE POLICY "Sports publicly readable" ON x402_sports
  FOR SELECT USING (true);
CREATE POLICY "Sports upsert via service role" ON x402_sports
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Sports update via service role" ON x402_sports
  FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "Events publicly readable" ON x402_events
  FOR SELECT USING (true);
CREATE POLICY "Events upsert via service role" ON x402_events
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Events update via service role" ON x402_events
  FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "Bookmakers publicly readable" ON x402_bookmakers
  FOR SELECT USING (true);
CREATE POLICY "Bookmakers upsert via service role" ON x402_bookmakers
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Bookmakers update via service role" ON x402_bookmakers
  FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "Odds markets publicly readable" ON x402_odds_markets
  FOR SELECT USING (true);
CREATE POLICY "Odds markets upsert via service role" ON x402_odds_markets
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Odds markets update via service role" ON x402_odds_markets
  FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "Odds outcomes publicly readable" ON x402_odds_outcomes
  FOR SELECT USING (true);
CREATE POLICY "Odds outcomes upsert via service role" ON x402_odds_outcomes
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Odds outcomes update via service role" ON x402_odds_outcomes
  FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "Odds snapshots publicly readable" ON x402_odds_snapshots
  FOR SELECT USING (true);
CREATE POLICY "Odds snapshots insert via service role" ON x402_odds_snapshots
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Event slug ↔ contract eventId mapping (Option B)
CREATE TABLE IF NOT EXISTS x402_event_slugs (
  slug TEXT PRIMARY KEY, -- e.g., "nba:us:moneyline:lakers:warriors"
  contract_event_id BIGINT NOT NULL, -- on-chain uint64 eventId
  market_address TEXT, -- optional EVM market address
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_slugs_contract_event_id ON x402_event_slugs(contract_event_id);

CREATE TRIGGER update_event_slugs_updated_at BEFORE UPDATE ON x402_event_slugs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE x402_event_slugs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Event slugs publicly readable" ON x402_event_slugs
  FOR SELECT USING (true);
CREATE POLICY "Event slugs upsert via service role" ON x402_event_slugs
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Event slugs update via service role" ON x402_event_slugs
  FOR UPDATE USING (auth.role() = 'service_role');

-- Transactions publicly readable
CREATE POLICY "Transactions publicly readable" ON x402_transactions
  FOR SELECT USING (true);

-- Insert sample data for development
INSERT INTO x402_users (wallet_address, username, is_agent, balance) VALUES
  ('0x1234567890123456789012345678901234567890', 'Agent_x402_Alpha', true, 10000.00),
  ('0x2345678901234567890123456789012345678901', 'Agent_x402_Beta', true, 15000.00),
  ('0x3456789012345678901234567890123456789012', 'Agent_x402_Gamma', true, 8000.00);

-- Insert sample markets (slug may be reused; event_id is per game)
INSERT INTO x402_markets (sport_key, event_id, slug, market_type, home_team, away_team, total_volume, active_bets) VALUES
  ('nba', 'nba:us:moneyline:lakers:warriors:2025-10-28', 'nba:us:moneyline:lakers:warriors', 'h2h', 'lakers', 'warriors', 50000.00, 25),
  ('nba', 'nba:us:spreads:lakers:warriors:2025-10-28', 'nba:us:spreads:lakers:warriors', 'spreads', 'lakers', 'warriors', 35000.00, 18),
  ('nfl', 'nfl:us:moneyline:chiefs:bills:2025-10-28', 'nfl:us:moneyline:chiefs:bills', 'h2h', 'chiefs', 'bills', 75000.00, 42),
  ('mlb', 'mlb:us:totals:dodgers:yankees:2025-10-28', 'mlb:us:totals:dodgers:yankees', 'totals', 'dodgers', 'yankees', 28000.00, 15);

-- ================================================
-- Odds API data model: sports, events, bookmakers, odds, scores
-- ================================================

-- Sports catalog (optional, aligns with /v4/sports)
CREATE TABLE IF NOT EXISTS x402_sports (
  sport_key TEXT PRIMARY KEY,
  group_name TEXT,
  title TEXT,
  description TEXT,
  in_season BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Events (aligns with event objects returned by /odds and /scores)
CREATE TABLE IF NOT EXISTS x402_events (
  id TEXT PRIMARY KEY, -- odds API event id
  sport_key TEXT NOT NULL REFERENCES x402_sports(sport_key) ON DELETE RESTRICT,
  commence_time TIMESTAMP WITH TIME ZONE NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  last_update TIMESTAMP WITH TIME ZONE,
  metadata JSONB, -- any extra fields from providers
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bookmakers (aligns with bookmakers in odds payload)
CREATE TABLE IF NOT EXISTS x402_bookmakers (
  key TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  region TEXT,
  last_seen TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Odds markets per event and bookmaker
CREATE TABLE IF NOT EXISTS x402_odds_markets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id TEXT NOT NULL REFERENCES x402_events(id) ON DELETE CASCADE,
  bookmaker_key TEXT NOT NULL REFERENCES x402_bookmakers(key) ON DELETE RESTRICT,
  market_type TEXT NOT NULL CHECK (market_type IN ('h2h','spreads','totals','outrights','h2h_lay','outrights_lay')),
  -- Optional links and metadata
  bookmaker_event_url TEXT,
  bookmaker_market_url TEXT,
  bookmaker_betslip_url TEXT,
  source_market_id TEXT,
  bet_limit NUMERIC(18, 2),
  last_update TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, bookmaker_key, market_type)
);

-- Odds outcomes for a given market
CREATE TABLE IF NOT EXISTS x402_odds_outcomes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  odds_market_id UUID NOT NULL REFERENCES x402_odds_markets(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- team or selection name
  price NUMERIC(10, 4) NOT NULL, -- price per odds_format
  odds_format TEXT NOT NULL CHECK (odds_format IN ('american','decimal')),
  point NUMERIC(10, 2), -- spread or total line, nullable
  side TEXT CHECK (side IN ('back','lay')),
  source_outcome_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(odds_market_id, name, point)
);

-- Raw odds snapshots (optional auditing/debug)
CREATE TABLE IF NOT EXISTS x402_odds_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id TEXT NOT NULL REFERENCES x402_events(id) ON DELETE CASCADE,
  bookmaker_key TEXT NOT NULL REFERENCES x402_bookmakers(key) ON DELETE RESTRICT,
  market_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  -- Historical snapshot timestamp (when odds applied in history queries)
  as_of TIMESTAMP WITH TIME ZONE,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scores per event (aligns with /v4/sports/{sport}/scores)
CREATE TABLE IF NOT EXISTS x402_event_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id TEXT NOT NULL REFERENCES x402_events(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT FALSE,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  last_update TIMESTAMP WITH TIME ZONE,
  scores_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id)
);

-- Historical event snapshots (aligns with /v4/historical/sports/{sport}/events)
CREATE TABLE IF NOT EXISTS x402_event_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id TEXT NOT NULL REFERENCES x402_events(id) ON DELETE CASCADE,
  sport_key TEXT NOT NULL REFERENCES x402_sports(sport_key) ON DELETE RESTRICT,
  commence_time TIMESTAMP WITH TIME ZONE NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  last_update TIMESTAMP WITH TIME ZONE,
  snapshot_at TIMESTAMP WITH TIME ZONE NOT NULL,
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_events_sport_time ON x402_events(sport_key, commence_time DESC);
CREATE INDEX IF NOT EXISTS idx_odds_markets_event_bookmaker ON x402_odds_markets(event_id, bookmaker_key);
CREATE INDEX IF NOT EXISTS idx_odds_outcomes_market_name ON x402_odds_outcomes(odds_market_id, name);
CREATE INDEX IF NOT EXISTS idx_event_scores_event ON x402_event_scores(event_id);
CREATE INDEX IF NOT EXISTS idx_event_snapshots_event_time ON x402_event_snapshots(event_id, snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_odds_markets_source_market_id ON x402_odds_markets(source_market_id);
CREATE INDEX IF NOT EXISTS idx_odds_outcomes_source_outcome_id ON x402_odds_outcomes(source_outcome_id);

-- Enable RLS for new tables
ALTER TABLE x402_sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE x402_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE x402_bookmakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE x402_odds_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE x402_odds_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE x402_odds_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE x402_event_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE x402_event_snapshots ENABLE ROW LEVEL SECURITY;

-- Public read policies (odds and scores should be readable)
DROP POLICY IF EXISTS "Sports publicly readable" ON x402_sports;
DROP POLICY IF EXISTS "Events publicly readable" ON x402_events;
DROP POLICY IF EXISTS "Bookmakers publicly readable" ON x402_bookmakers;
DROP POLICY IF EXISTS "Odds markets publicly readable" ON x402_odds_markets;
DROP POLICY IF EXISTS "Odds outcomes publicly readable" ON x402_odds_outcomes;
DROP POLICY IF EXISTS "Odds snapshots publicly readable" ON x402_odds_snapshots;
DROP POLICY IF EXISTS "Event scores publicly readable" ON x402_event_scores;
DROP POLICY IF EXISTS "Event snapshots publicly readable" ON x402_event_snapshots;
CREATE POLICY "Sports publicly readable" ON x402_sports FOR SELECT USING (true);
CREATE POLICY "Events publicly readable" ON x402_events FOR SELECT USING (true);
CREATE POLICY "Bookmakers publicly readable" ON x402_bookmakers FOR SELECT USING (true);
CREATE POLICY "Odds markets publicly readable" ON x402_odds_markets FOR SELECT USING (true);
CREATE POLICY "Odds outcomes publicly readable" ON x402_odds_outcomes FOR SELECT USING (true);
CREATE POLICY "Odds snapshots publicly readable" ON x402_odds_snapshots FOR SELECT USING (true);
CREATE POLICY "Event scores publicly readable" ON x402_event_scores FOR SELECT USING (true);
CREATE POLICY "Event snapshots publicly readable" ON x402_event_snapshots FOR SELECT USING (true);

-- Updated at triggers for new tables
DROP TRIGGER IF EXISTS update_sports_updated_at ON x402_sports;
CREATE TRIGGER update_sports_updated_at BEFORE UPDATE ON x402_sports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_events_updated_at ON x402_events;
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON x402_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bookmakers_updated_at ON x402_bookmakers;
CREATE TRIGGER update_bookmakers_updated_at BEFORE UPDATE ON x402_bookmakers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_odds_markets_updated_at ON x402_odds_markets;
CREATE TRIGGER update_odds_markets_updated_at BEFORE UPDATE ON x402_odds_markets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_odds_outcomes_updated_at ON x402_odds_outcomes;
CREATE TRIGGER update_odds_outcomes_updated_at BEFORE UPDATE ON x402_odds_outcomes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_event_scores_updated_at ON x402_event_scores;
CREATE TRIGGER update_event_scores_updated_at BEFORE UPDATE ON x402_event_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_event_snapshots_updated_at BEFORE UPDATE ON x402_event_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================================
-- Sports Registry (database-side)
-- Structured tables to manage sports, regions, and teams
-- Mirrors on-chain registry concepts for flexible off-chain use
-- ==========================================================

-- Sports catalog
CREATE TABLE IF NOT EXISTS x402_sports_registry_sports (
  sport_key TEXT PRIMARY KEY,
  title TEXT,
  group_name TEXT,
  is_team_sport BOOLEAN DEFAULT TRUE,
  enabled BOOLEAN DEFAULT TRUE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (sport_key = lower(sport_key))
);

-- Regions per sport
CREATE TABLE IF NOT EXISTS x402_sports_registry_regions (
  sport_key TEXT NOT NULL REFERENCES x402_sports_registry_sports(sport_key) ON DELETE CASCADE,
  region_key TEXT NOT NULL,
  title TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (region_key = lower(region_key)),
  PRIMARY KEY (sport_key, region_key)
);

-- Teams per sport (not necessarily bound to a region)
CREATE TABLE IF NOT EXISTS x402_sports_registry_teams (
  sport_key TEXT NOT NULL REFERENCES x402_sports_registry_sports(sport_key) ON DELETE CASCADE,
  team_name TEXT NOT NULL,
  city TEXT,
  nickname TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (team_name = lower(team_name)),
  UNIQUE (sport_key, team_name)
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_x402_sr_sports_enabled ON x402_sports_registry_sports(enabled);
CREATE INDEX IF NOT EXISTS idx_x402_sr_regions_sport ON x402_sports_registry_regions(sport_key);
CREATE INDEX IF NOT EXISTS idx_x402_sr_teams_sport ON x402_sports_registry_teams(sport_key);

-- Enable RLS
ALTER TABLE x402_sports_registry_sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE x402_sports_registry_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE x402_sports_registry_teams ENABLE ROW LEVEL SECURITY;

-- Public read policies (agents and clients can read registry)
CREATE POLICY "Sports registry publicly readable"
  ON x402_sports_registry_sports
  FOR SELECT
  USING (true);

CREATE POLICY "Regions publicly readable"
  ON x402_sports_registry_regions
  FOR SELECT
  USING (true);

CREATE POLICY "Teams publicly readable"
  ON x402_sports_registry_teams
  FOR SELECT
  USING (true);

-- updated_at triggers
CREATE TRIGGER update_x402_sr_sports_updated_at
  BEFORE UPDATE ON x402_sports_registry_sports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_x402_sr_regions_updated_at
  BEFORE UPDATE ON x402_sports_registry_regions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_x402_sr_teams_updated_at
  BEFORE UPDATE ON x402_sports_registry_teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Minimal seed data for convenience (can be extended or removed as desired)
INSERT INTO x402_sports_registry_sports (sport_key, title, group_name, is_team_sport)
VALUES
  ('nba', 'NBA', 'basketball', true),
  ('nfl', 'NFL', 'football', true),
  ('mlb', 'MLB', 'baseball', true),
  ('nhl', 'NHL', 'hockey', true),
  ('epl', 'EPL', 'soccer', true),
  ('tennis', 'Tennis', 'Tennis', false),
  ('politics', 'Politics', 'Special', false),
  ('events', 'Events', 'Special', false)
ON CONFLICT (sport_key) DO NOTHING;

INSERT INTO x402_sports_registry_regions (sport_key, region_key, title)
VALUES
  ('nba', 'us', 'United States'),
  ('nfl', 'us', 'United States'),
  ('mlb', 'us', 'United States'),
  ('nhl', 'us', 'United States'),
  ('epl', 'uk', 'United Kingdom'),
  ('tennis', 'global', 'Global'),
  ('events', 'global', 'Global'),
  ('politics', 'us', 'United States')
ON CONFLICT (sport_key, region_key) DO NOTHING;

INSERT INTO x402_sports_registry_teams (sport_key, team_name, city, nickname)
VALUES
  ('nba', 'lakers', 'Los Angeles', 'Lakers'),
  ('nba', 'warriors', 'San Francisco', 'Warriors'),
  ('nfl', 'chiefs', 'Kansas City', 'Chiefs'),
  ('nfl', 'bills', 'Buffalo', 'Bills')
ON CONFLICT (sport_key, team_name) DO NOTHING;