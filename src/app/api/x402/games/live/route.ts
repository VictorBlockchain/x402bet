import { NextRequest, NextResponse } from 'next/server'
import { verifySeiPayment } from '@/lib/payments/sei'
import { toOddsSportKey } from '@/lib/config/sports'
import { supabaseAdmin } from '@/lib/supabase/client'

const API_HOST = 'https://api.the-odds-api.com'
const API_KEY = process.env.ODDS_API_KEY

function parseIntSafe(v: string | null, def: number): number {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sportParam = searchParams.get('sport')
    const agent = searchParams.get('agent')
    const paymentTxHash = searchParams.get('paymentTxHash')
    const daysFrom = parseIntSafe(searchParams.get('daysFrom'), 2)

    if (!API_KEY) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }
    if (!sportParam) {
      return NextResponse.json({ error: 'Missing sport parameter' }, { status: 400 })
    }
    if (!paymentTxHash) {
      return NextResponse.json({ error: 'Missing paymentTxHash' }, { status: 400 })
    }

    // Verify payment: 0.01 SEI sent to fee recipient
    const pay = await verifySeiPayment(paymentTxHash, agent || undefined)
    if (!pay.ok) {
      return NextResponse.json({ error: 'Payment verification failed', reason: pay.reason }, { status: 403 })
    }

    const sport = toOddsSportKey(sportParam)
    const apiUrl = new URL(`${API_HOST}/v4/sports/${sport}/scores`)
    apiUrl.searchParams.set('apiKey', API_KEY)
    apiUrl.searchParams.set('daysFrom', String(daysFrom))

    const resp = await fetch(apiUrl.toString(), { headers: { Accept: 'application/json' } })
    if (!resp.ok) {
      return NextResponse.json({ error: `Upstream error ${resp.status}` }, { status: resp.status })
    }
    const events = await resp.json()

    const nowMs = Date.now()
    const live = (Array.isArray(events) ? events : []).filter((e: any) => {
      const ctMs = e.commence_time ? Date.parse(e.commence_time) : NaN
      return Number.isFinite(ctMs) && ctMs <= nowMs && !e.completed
    })

    const data = live.map((e: any) => ({
      event_id: e.id,
      sport_key: e.sport_key,
      commence_time: e.commence_time,
      home_team: e.home_team,
      away_team: e.away_team,
      completed: !!e.completed,
      scores: e.scores || null,
      last_update: e.last_update || null,
    }))

    // Update scores in markets table for each live event
    const scoreUpdates = []
    for (const event of live) {
      if (event.scores && Array.isArray(event.scores) && event.scores.length >= 2) {
        try {
          // Extract home and away scores from the scores array
          const homeScore = event.scores.find((s: any) => 
            s.name === event.home_team || s.name?.toLowerCase().includes('home')
          )?.score
          const awayScore = event.scores.find((s: any) => 
            s.name === event.away_team || s.name?.toLowerCase().includes('away')
          )?.score

          if (typeof homeScore === 'number' && typeof awayScore === 'number') {
            // Update markets table where event_id matches
            const { error: updateError } = await supabaseAdmin
              .from('x402_markets')
              .update({
                home_score_final: homeScore,
                away_score_final: awayScore,
                scores_set: true,
                updated_at: new Date().toISOString()
              })
              .eq('event_id', event.id)

            if (updateError) {
              console.error(`Failed to update scores for event ${event.id}:`, updateError.message)
            } else {
              scoreUpdates.push({
                event_id: event.id,
                home_score: homeScore,
                away_score: awayScore,
                updated: true
              })
            }
          }
        } catch (error: any) {
          console.error(`Error processing scores for event ${event.id}:`, error.message)
        }
      }
    }

    // Fetch latest odds for live events (moneyline, spreads, totals) and snapshot to markets
    const oddsUrl = new URL(`${API_HOST}/v4/sports/${sport}/odds`)
    oddsUrl.searchParams.set('apiKey', API_KEY)
    oddsUrl.searchParams.set('regions', 'us')
    oddsUrl.searchParams.set('markets', 'h2h,spreads,totals')
    oddsUrl.searchParams.set('oddsFormat', 'american')

    const oddsResp = await fetch(oddsUrl.toString(), { headers: { Accept: 'application/json' } })
    let oddsEvents: any[] = []
    if (oddsResp.ok) {
      const oddsJson = await oddsResp.json()
      oddsEvents = Array.isArray(oddsJson) ? oddsJson : []
    } else {
      console.warn(`Odds upstream error ${oddsResp.status}`)
    }

    // Build quick index by event id
    const oddsByEvent: Record<string, any> = {}
    for (const ev of oddsEvents) {
      if (ev && ev.id) oddsByEvent[ev.id] = ev
    }

    // For each live event, pick a bookmaker and extract odds snapshot
    const oddsUpdates = [] as any[]
    for (const event of live) {
      const ev = oddsByEvent[event.id]
      if (!ev || !Array.isArray(ev.bookmakers)) continue

      // Prefer a major bookmaker if present, else first
      const preferredKeys = ['fanduel', 'draftkings', 'betmgm', 'caesars', 'betrivers']
      let bm = ev.bookmakers.find((b: any) => preferredKeys.includes(String(b.key).toLowerCase()))
      if (!bm) bm = ev.bookmakers[0]
      if (!bm) continue

      const bookmaker_key = bm.key || bm.title || 'unknown'
      let home_moneyline_price: number | null = null
      let away_moneyline_price: number | null = null
      let home_spread_point: number | null = null
      let home_spread_price: number | null = null
      let away_spread_point: number | null = null
      let away_spread_price: number | null = null
      let total_point: number | null = null
      let over_price: number | null = null
      let under_price: number | null = null

      const homeFull = event.home_team
      const awayFull = event.away_team

      const markets = Array.isArray(bm.markets) ? bm.markets : []
      const h2h = markets.find((m: any) => m?.key === 'h2h')
      const spreads = markets.find((m: any) => m?.key === 'spreads')
      const totals = markets.find((m: any) => m?.key === 'totals')

      if (h2h && Array.isArray(h2h.outcomes)) {
        for (const oc of h2h.outcomes) {
          if (oc?.name === homeFull && typeof oc?.price === 'number') home_moneyline_price = oc.price
          if (oc?.name === awayFull && typeof oc?.price === 'number') away_moneyline_price = oc.price
        }
      }

      if (spreads && Array.isArray(spreads.outcomes)) {
        for (const oc of spreads.outcomes) {
          if (oc?.name === homeFull) {
            if (typeof oc?.point === 'number') home_spread_point = oc.point
            if (typeof oc?.price === 'number') home_spread_price = oc.price
          }
          if (oc?.name === awayFull) {
            if (typeof oc?.point === 'number') away_spread_point = oc.point
            if (typeof oc?.price === 'number') away_spread_price = oc.price
          }
        }
      }

      if (totals && Array.isArray(totals.outcomes)) {
        const over = totals.outcomes.find((o: any) => String(o?.name || '').toLowerCase().includes('over'))
        const under = totals.outcomes.find((o: any) => String(o?.name || '').toLowerCase().includes('under'))
        if (over && typeof over.point === 'number') total_point = over.point
        if (under && typeof under.point === 'number' && total_point === null) total_point = under.point
        if (over && typeof over.price === 'number') over_price = over.price
        if (under && typeof under.price === 'number') under_price = under.price
      }

      // Update snapshot columns
      const { error: oddsUpdateError } = await supabaseAdmin
        .from('x402_markets')
        .update({
          bookmaker_key,
          odds_format: 'american',
          home_moneyline_price,
          away_moneyline_price,
          home_spread_point,
          home_spread_price,
          away_spread_point,
          away_spread_price,
          total_point,
          over_price,
          under_price,
          last_odds_update: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('event_id', event.id)

      if (oddsUpdateError) {
        console.error(`Failed to update odds for event ${event.id}:`, oddsUpdateError.message)
      } else {
        oddsUpdates.push({
          event_id: event.id,
          bookmaker_key,
          updated: true,
        })
      }
    }

    return NextResponse.json({
      paid: true,
      payment: { from: pay.payer, to: pay.recipient, valueWei: pay.amountWei },
      sport: sport,
      count: data.length,
      data,
      scoreUpdates: scoreUpdates.length > 0 ? scoreUpdates : undefined,
      oddsUpdates: oddsUpdates.length > 0 ? oddsUpdates : undefined,
      timestamp: new Date().toISOString(),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}