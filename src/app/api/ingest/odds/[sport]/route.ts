import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

const API_HOST = 'https://api.the-odds-api.com';
const API_KEY = process.env.ODDS_API_KEY;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sport: string }> }
) {
  try {
    if (!API_KEY) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const { sport } = await context.params;
    const url = new URL(`${API_HOST}/v4/sports/${sport}/odds`);
    url.searchParams.set('apiKey', API_KEY);
    // allow optional filters
    const regions = request.nextUrl.searchParams.get('regions');
    const markets = request.nextUrl.searchParams.get('markets');
    const bookmakers = request.nextUrl.searchParams.get('bookmakers');
    const eventIds = request.nextUrl.searchParams.get('eventIds');
    if (regions) url.searchParams.set('regions', regions);
    if (markets) url.searchParams.set('markets', markets);
    if (bookmakers) url.searchParams.set('bookmakers', bookmakers);
    if (eventIds) url.searchParams.set('eventIds', eventIds);

    const resp = await fetch(url.toString());
    if (!resp.ok) {
      return NextResponse.json({ error: `Upstream error ${resp.status}` }, { status: resp.status });
    }

    const payload = await resp.json();

    // Upsert bookmakers first
    const bookmakerSet = new Map<string, any>();
    for (const event of payload) {
      for (const bm of event.bookmakers || []) {
        if (!bookmakerSet.has(bm.key)) {
          bookmakerSet.set(bm.key, {
            key: bm.key,
            title: bm.title,
            last_seen: bm.last_update ?? null,
            metadata: null,
          });
        }
      }
    }

    if (bookmakerSet.size) {
      const { error } = await supabaseAdmin
        .from('x402_bookmakers')
        .upsert([...bookmakerSet.values()], { onConflict: 'key' });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Upsert events present in odds payload
    const eventsRows = payload.map((e: any) => ({
      id: e.id,
      sport_key: e.sport_key,
      commence_time: e.commence_time,
      home_team: e.home_team,
      away_team: e.away_team,
      completed: !!e.completed,
      last_update: e.last_update ?? null,
      metadata: null,
    }));
    if (eventsRows.length) {
      const { error } = await supabaseAdmin
        .from('x402_events')
        .upsert(eventsRows, { onConflict: 'id' });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Upsert markets and outcomes; insert snapshot
    let marketCount = 0;
    let outcomeCount = 0;
    let snapshotCount = 0;

    for (const e of payload) {
      const eventId = e.id;
      for (const bm of e.bookmakers || []) {
        const bookmakerKey = bm.key;
        for (const market of bm.markets || []) {
          const marketRow = {
            event_id: eventId,
            bookmaker_key: bookmakerKey,
            market_type: market.key,
            last_update: market.last_update ?? bm.last_update ?? null,
            metadata: null,
            link_url: market.link ?? null,
            source_market_id: market.sid ?? null,
            bet_limit_json: market.betLimits ?? null,
          };
          const { data: upMarket, error: mErr } = await supabaseAdmin
            .from('x402_odds_markets')
            .upsert(marketRow, { onConflict: 'event_id,bookmaker_key,market_type' })
            .select('id')
            .single();
          if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });
          marketCount += 1;

          // outcomes
          const outcomeRows = (market.outcomes || []).map((o: any) => ({
            odds_market_id: upMarket.id,
            name: o.name,
            price: o.price ?? null,
            point: o.point ?? null,
            side: o.side ?? null,
            source_outcome_id: o.sid ?? null,
          }));
          if (outcomeRows.length) {
            const { error: oErr } = await supabaseAdmin
              .from('x402_odds_outcomes')
              .upsert(outcomeRows, { onConflict: 'odds_market_id,name,point' });
            if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 });
            outcomeCount += outcomeRows.length;
          }

          // snapshots per market
          const snapshotRow = {
            as_of: bm.last_update ?? market.last_update ?? new Date().toISOString(),
            sport_key: e.sport_key,
            event_id: eventId,
            bookmaker_key: bookmakerKey,
            market_type: market.key,
            region: bm.region ?? null,
            odds_json: market,
          };
          const { error: sErr } = await supabaseAdmin
            .from('x402_odds_snapshots')
            .insert(snapshotRow);
          if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
          snapshotCount += 1;
        }
      }
    }

    return NextResponse.json({
      sport,
      eventsUpserted: eventsRows.length,
      marketsUpserted: marketCount,
      outcomesUpserted: outcomeCount,
      snapshotsInserted: snapshotCount,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
  }
}