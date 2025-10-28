import { NextRequest, NextResponse } from 'next/server'
import { verifySeiPayment } from '@/lib/payments/sei'
import { toOddsSportKey } from '@/lib/config/sports'

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
    const withinHours = parseIntSafe(searchParams.get('withinHours'), 24)
    // Production: mockEventId support removed

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

    // Production: always fetch from Odds API
    if (!API_KEY) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }
    const apiUrl = new URL(`${API_HOST}/v4/sports/${sport}/events`)
    apiUrl.searchParams.set('apiKey', API_KEY)

    const resp = await fetch(apiUrl.toString(), { headers: { Accept: 'application/json' } })
    if (!resp.ok) {
      return NextResponse.json({ error: `Upstream error ${resp.status}` }, { status: resp.status })
    }
    const events = await resp.json()

    const nowMs = Date.now()
    const maxMs = nowMs + withinHours * 60 * 60 * 1000
    const upcoming = (Array.isArray(events) ? events : []).filter((e: any) => {
      const ctMs = e.commence_time ? Date.parse(e.commence_time) : NaN
      return Number.isFinite(ctMs) && ctMs > nowMs && ctMs <= maxMs
    })

    const data = upcoming.map((e: any) => ({
      event_id: e.id,
      sport_key: e.sport_key,
      commence_time: e.commence_time,
      home_team: e.home_team,
      away_team: e.away_team,
      completed: !!e.completed,
      last_update: e.last_update || null,
    }))

    return NextResponse.json({
      paid: true,
      payment: { from: pay.payer, to: pay.recipient, valueWei: pay.amountWei },
      sport: sport,
      window_hours: withinHours,
      count: data.length,
      data,
      timestamp: new Date().toISOString(),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}