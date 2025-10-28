import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

type MarketType = 'h2h' | 'spreads' | 'totals';

interface PlaceBetBody {
  user_id: string;
  sport_key: string;
  event_id: string;
  market_type: MarketType;
  selection: string;
  odds: number; // American odds for now
  odds_format?: 'american' | 'decimal';
  stake: number;
  bookmaker: string;
  event_data: {
    home_team: string;
    away_team: string;
    commence_time: string;
  };
}

function validateBody(body: any): { valid: boolean; error?: string } {
  const required = [
    'user_id',
    'sport_key',
    'event_id',
    'market_type',
    'selection',
    'odds',
    'stake',
    'bookmaker',
    'event_data',
  ];
  for (const key of required) {
    if (!(key in body)) return { valid: false, error: `Missing field: ${key}` };
  }
  if (!['h2h', 'spreads', 'totals'].includes(body.market_type)) {
    return { valid: false, error: 'Invalid market_type' };
  }
  if (typeof body.odds !== 'number' || !Number.isFinite(body.odds)) {
    return { valid: false, error: 'Invalid odds' };
  }
  if (typeof body.stake !== 'number' || body.stake <= 0) {
    return { valid: false, error: 'Invalid stake' };
  }
  return { valid: true };
}

function potentialPayoutAmerican(stake: number, odds: number): number {
  // American odds: negative means favorite, positive means underdog
  if (odds > 0) {
    return stake + (stake * odds) / 100;
  }
  return stake + (stake * 100) / Math.abs(odds);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PlaceBetBody;
    const { valid, error } = validateBody(body);
    if (!valid) {
      return NextResponse.json({ error }, { status: 400 });
    }

    // Basic rate-limit by IP (best-effort, per-runtime)
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    // In production, use a proper rate-limit backing store (KV/Redis)

    const oddsFormat = body.odds_format || 'american';
    const potential_payout =
      oddsFormat === 'american'
        ? potentialPayoutAmerican(body.stake, body.odds)
        : body.stake * body.odds; // decimal format fallback

    // Insert bet (immutability: status starts as pending)
    const { data, error: insertError } = await supabaseAdmin
      .from('x402_bets')
      .insert({
        user_id: body.user_id,
        sport_key: body.sport_key,
        event_id: body.event_id,
        market_type: body.market_type,
        selection: body.selection,
        odds: body.odds,
        odds_format: oddsFormat,
        stake: body.stake,
        potential_payout,
        status: 'pending',
        bookmaker: body.bookmaker,
        event_data: body.event_data,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ bet: data, ip }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
}