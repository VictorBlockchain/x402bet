import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

const API_HOST = 'https://api.the-odds-api.com';
const API_KEY = process.env.ODDS_API_KEY;

export async function POST(_request: NextRequest) {
  try {
    if (!API_KEY) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const resp = await fetch(`${API_HOST}/v4/sports/?apiKey=${API_KEY}`);
    if (!resp.ok) {
      return NextResponse.json({ error: `Upstream error ${resp.status}` }, { status: resp.status });
    }
    const sports = await resp.json();

    const payload = sports.map((s: any) => ({
      sport_key: s.key,
      group_name: s.group,
      title: s.title,
      description: s.description ?? null,
      in_season: !!s.active,
    }));

    const { error } = await supabaseAdmin
      .from('x402_sports')
      .upsert(payload, { onConflict: 'sport_key' });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ count: payload.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
  }
}