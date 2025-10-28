import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

const API_HOST = 'https://api.the-odds-api.com';
const API_KEY = process.env.ODDS_API_KEY;

type ScoreRow = {
  event_id: string;
  sport_key: string;
  completed: boolean;
  scores_json: any;
  home_score: number | null;
  away_score: number | null;
  last_update: string | null;
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sport: string }> }
) {
  try {
    if (!API_KEY) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const { sport } = await context.params;
    const url = new URL(`${API_HOST}/v4/sports/${sport}/scores`);
    url.searchParams.set('apiKey', API_KEY);
    const daysFrom = request.nextUrl.searchParams.get('daysFrom');
    if (daysFrom) url.searchParams.set('daysFrom', daysFrom);

    const resp = await fetch(url.toString());
    if (!resp.ok) {
      return NextResponse.json({ error: `Upstream error ${resp.status}` }, { status: resp.status });
    }
    const scores = await resp.json();

    const scoreRows: ScoreRow[] = scores.map((s: any) => ({
      event_id: s.id,
      sport_key: s.sport_key,
      completed: !!s.completed,
      scores_json: s,
      home_score: s.scores?.find((x: any) => x.name?.toLowerCase().includes('home'))?.score ?? null,
      away_score: s.scores?.find((x: any) => x.name?.toLowerCase().includes('away'))?.score ?? null,
      last_update: s.last_update ?? null,
    }));

    const { error: upsertErr } = await supabaseAdmin
      .from('x402_event_scores')
      .upsert(scoreRows, { onConflict: 'event_id' });
    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    const completedIds: string[] = scoreRows
      .filter((r) => r.completed)
      .map((r) => r.event_id);
    if (completedIds.length) {
      const { error: updateErr } = await supabaseAdmin
        .from('x402_events')
        .update({ completed: true })
        .in('id', completedIds);
      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ count: scoreRows.length, sport });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
  }
}