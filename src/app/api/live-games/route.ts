import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sport = searchParams.get('sport') || 'americanfootball_nfl'
    const includeClosed = searchParams.get('includeClosed') === 'true'
    
    // Get current time for filtering live games
    const now = new Date()
    
    // Query x402_markets by sport; we'll apply live filters in code to avoid
    // excluding rows with NULL start/cutoff times.
    // Explicit select list (no trailing comma) to avoid PostgREST parse errors
    const { data: markets, error } = await supabaseAdmin
      .from('x402_markets')
      .select(
        'event_id,sport_key,home_team,away_team,start_time,cutoff_time,home_score_final,away_score_final,scores_set,is_open,cancelled,settled,bookmaker_key,odds_format,home_moneyline_price,away_moneyline_price,home_spread_point,home_spread_price,away_spread_point,away_spread_price,total_point,over_price,under_price,last_odds_update,updated_at,market_address'
      )
      .eq('sport_key', sport)
      .order('start_time', { ascending: false })

    if (error) {
      console.error('Error fetching live games:', error)
      return NextResponse.json({ error: 'Failed to fetch live games' }, { status: 500 })
    }

    // Transform and filter to only live games: start_time <= now (or NULL)
    // and cutoff_time >= now (or NULL), not cancelled/settled, and open.
    // Help TypeScript understand the shape of returned rows
    type MarketRow = {
      event_id: string
      sport_key: string
      home_team: string
      away_team: string
      start_time?: string | null
      cutoff_time?: string | null
      home_score_final?: number | null
      away_score_final?: number | null
      scores_set?: boolean | null
      is_open?: boolean | null
      cancelled?: boolean | null
      settled?: boolean | null
      bookmaker_key?: string | null
      odds_format?: string | null
      home_moneyline_price?: number | null
      away_moneyline_price?: number | null
      home_spread_point?: number | null
      home_spread_price?: number | null
      away_spread_point?: number | null
      away_spread_price?: number | null
      total_point?: number | null
      over_price?: number | null
      under_price?: number | null
      last_odds_update?: string | null
      updated_at?: string | null
      market_address?: string | null
    }

    const liveGames = ((markets ?? []) as MarketRow[])
      .filter(market => {
        if (includeClosed) return true
        const startMs = market.start_time ? Date.parse(market.start_time) : NaN
        const cutoffMs = market.cutoff_time ? Date.parse(market.cutoff_time) : NaN
        const started = Number.isFinite(startMs) ? (startMs <= now.getTime()) : true
        const notPastCutoff = Number.isFinite(cutoffMs) ? (cutoffMs >= now.getTime()) : true
        return (
          started &&
          notPastCutoff &&
          Boolean(market.is_open) &&
          !Boolean(market.cancelled) &&
          !Boolean(market.settled)
        )
      })
      .map(market => ({
      id: market.event_id,
      event_id: market.event_id,
      sport_key: market.sport_key,
      home_team: market.home_team,
      away_team: market.away_team,
      start_time: market.start_time,
      cutoff_time: market.cutoff_time,
      
      // Current scores
      home_score: market.home_score_final || 0,
      away_score: market.away_score_final || 0,
      scores_set: market.scores_set || false,
      
      // Odds data
      bookmaker: market.bookmaker_key,
      odds_format: market.odds_format,
      
      // Moneyline odds
      homeOdds: market.home_moneyline_price,
      awayOdds: market.away_moneyline_price,
      
      // Spread odds
      homeSpreadPoint: market.home_spread_point,
      homeSpreadPrice: market.home_spread_price,
      awaySpreadPoint: market.away_spread_point,
      awaySpreadPrice: market.away_spread_price,
      
      // Totals odds
      totalPoint: market.total_point,
      overPrice: market.over_price,
      underPrice: market.under_price,
      
      // Metadata
      last_odds_update: market.last_odds_update,
      updated_at: market.updated_at,
      market_address: market.market_address,
      
      // Computed fields for UI
      isLive: true,
      quarter: 'Live', // Could be enhanced with actual quarter data
      timeRemaining: 'Live', // Could be enhanced with actual time data
      
      // Status indicators
      canBet: market.is_open && !market.cancelled && !market.settled && !market.scores_set,
      hasOdds: !!(
        (market.home_moneyline_price && market.away_moneyline_price) ||
        (market.home_spread_point && market.home_spread_price && market.away_spread_point && market.away_spread_price) ||
        (market.total_point && (market.over_price || market.under_price))
      )
    }))

    return NextResponse.json({
      success: true,
      sport,
      count: liveGames.length,
      games: liveGames,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Live games API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch live games', details: error.message },
      { status: 500 }
    )
  }
}