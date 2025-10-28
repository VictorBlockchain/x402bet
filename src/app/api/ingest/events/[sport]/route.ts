import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

const API_HOST = 'https://api.the-odds-api.com';
const API_KEY = process.env.ODDS_API_KEY;

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ sport: string }> }
) {
  try {
    if (!API_KEY) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const { sport } = await context.params;
    const url = `${API_HOST}/v4/sports/${sport}/events?apiKey=${API_KEY}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      return NextResponse.json({ error: `Upstream error ${resp.status}` }, { status: resp.status });
    }
    const events = await resp.json();

    const payload = events.map((e: any) => ({
      id: e.id,
      sport_key: e.sport_key,
      commence_time: e.commence_time,
      home_team: e.home_team,
      away_team: e.away_team,
      completed: !!e.completed,
      last_update: e.last_update ?? null,
      metadata: null,
    }));

    const { error } = await supabaseAdmin
      .from('x402_events')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ count: payload.length, sport });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
  }
}