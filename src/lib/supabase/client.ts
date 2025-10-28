import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Server-side client with service role key
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Database types
export interface User {
  id: string;
  wallet_address: string;
  email?: string;
  username?: string;
  is_agent: boolean;
  agent_config?: {
    max_exposure: number;
    liquidity_limit: number;
    auto_settle: boolean;
  };
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface Bet {
  id: string;
  user_id: string;
  sport_key: string;
  event_id: string;
  market_type: 'h2h' | 'spreads' | 'totals';
  selection: string;
  odds: number;
  odds_format: 'american' | 'decimal';
  stake: number;
  potential_payout: number;
  status: 'pending' | 'won' | 'lost' | 'cancelled' | 'settled';
  placed_at: string;
  settled_at?: string;
  settlement_hash?: string;
  bookmaker: string;
  event_data: {
    home_team: string;
    away_team: string;
    commence_time: string;
  };
  created_at: string;
  updated_at: string;
}

export interface Market {
  id: string;
  sport_key: string;
  event_id: string;
  slug?: string;
  market_type: string;
  home_team?: string;
  away_team?: string;
  total_volume: number;
  active_bets: number;
  last_odds_update: string;
  created_at: string;
  updated_at: string;

  // On-chain linkage (optional until synced)
  market_address?: string;
  factory?: string;
  creator?: string;
  contract_event_id?: number;

  // Core market state
  is_open?: boolean;
  cancelled?: boolean;
  settled?: boolean;
  is_push?: boolean;
  in_dispute?: boolean;

  // Fees & token
  fee_bps?: number;
  fee_recipient?: string;
  token_type?: 'native' | 'erc20';
  token?: string;

  // Config & outcome
  winning_selection?: number;
  payout_multiplier?: string; // NUMERIC(39,0) as string
  bonus_pool?: string; // NUMERIC(78,0) as string
  settlement_time?: string; // ISO timestamp

  home_selection_id?: number;
  away_selection_id?: number;
  spread_tenths?: number;
  spread_applies_to_home?: boolean;
  start_time?: string;
  cutoff_time?: string;
  min_bet?: string; // NUMERIC(78,0) as string
  max_bet?: string; // NUMERIC(78,0) as string
  oracle?: string;

  // Scores & pools
  home_score_final?: number;
  away_score_final?: number;
  scores_set?: boolean;
  home_pool?: string; // NUMERIC(78,0) as string
  away_pool?: string; // NUMERIC(78,0) as string
  total_pool?: string; // NUMERIC(78,0) as string
  home_bet_count?: number;
  away_bet_count?: number;

  last_onchain_sync?: string;
}

export interface Settlement {
  id: string;
  bet_id: string;
  result: 'won' | 'lost';
  payout_amount: number;
  settlement_source: string;
  settlement_data: any;
  processed_at: string;
  transaction_hash?: string;
  created_at: string;
}