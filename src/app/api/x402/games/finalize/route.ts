import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { verifySeiPayment } from '@/lib/payments/sei';
import { getDeployment } from '@/lib/config/deployment';
import { supabaseAdmin } from '@/lib/supabase/client';

// Oracle ABI for settlement functions
const ORACLE_ABI = [
  "function authorizedReporters(address reporter) view returns (bool)",
  "function setMarketSpreadTenths(address market, int16 newSpreadTenths) external",
  "function reportScoreForMarket(address market, uint16 homeScore, uint16 awayScore) external",
  "function isMarketSettled(address market) view returns (bool)",
  "function getMarketScores(address market) view returns (uint16 homeScore, uint16 awayScore, bool settled)"
];

// Minimal Market ABI to check if on-chain spread is configured
const MARKET_ABI = [
  "function spreadTenths() view returns (int16)",
  "function spreadAppliesToHome() view returns (bool)"
];

export async function POST(request: NextRequest) {
  try {
    const { eventId, paymentTxHash, agent } = await request.json();

    // Validate required parameters
    if (!eventId || !paymentTxHash) {
      return NextResponse.json(
        { error: 'Missing required fields: eventId, paymentTxHash' },
        { status: 400 }
      );
    }

    // Verify payment ($0.01 USD equivalent)
    const paymentResult = await verifySeiPayment(paymentTxHash, agent, 0.01);
    if (!paymentResult.ok) {
      return NextResponse.json(
        { error: `Payment verification failed: ${paymentResult.reason}` },
        { status: 402 }
      );
    }

    // Get market address from event_id
    const { data: market, error: marketError } = await supabaseAdmin
      .from('x402_markets')
      .select('market_address, event_id, home_team, away_team, scores_set, market_type, home_spread_point, away_spread_point')
      .eq('event_id', eventId)
      .maybeSingle();

    if (marketError || !market) {
      return NextResponse.json(
        { error: `No market found for event_id: ${eventId}` },
        { status: 404 }
      );
    }

    if (market.scores_set) {
      return NextResponse.json(
        { error: 'Market scores have already been finalized' },
        { status: 400 }
      );
    }

    // Fetch scores from Odds API
    const scoresApiKey = process.env.ODDS_API_KEY;
    if (!scoresApiKey) {
      return NextResponse.json(
        { error: 'Odds API key not configured' },
        { status: 500 }
      );
    }

    // Get sport key from event to construct scores API URL
    const { data: eventData } = await supabaseAdmin
      .from('x402_events')
      .select('sport_key')
      .eq('id', eventId)
      .maybeSingle();

    if (!eventData) {
      return NextResponse.json(
        { error: `Event not found: ${eventId}` },
        { status: 404 }
      );
    }

    // Fetch scores from Odds API
    const scoresUrl = `https://api.the-odds-api.com/v4/sports/${eventData.sport_key}/scores/?apiKey=${scoresApiKey}&eventIds=${eventId}&daysFrom=3`;
    
    const scoresResponse = await fetch(scoresUrl);
    if (!scoresResponse.ok) {
      return NextResponse.json(
        { error: `Failed to fetch scores from Odds API: ${scoresResponse.statusText}` },
        { status: 500 }
      );
    }

    const scoresData = await scoresResponse.json();

    if (!scoresData || (Array.isArray(scoresData) && scoresData.length === 0)) {
      return NextResponse.json(
        { error: `No scores found for event: ${eventId}` },
        { status: 404 }
      );
    }

    const event = Array.isArray(scoresData)
      ? (scoresData.find((e: any) => String(e?.id || '') === String(eventId)) || scoresData[0])
      : scoresData;
    const completedFlag =
      typeof event?.completed === 'boolean'
        ? event.completed === true
        : String(event?.completed || '').toLowerCase() === 'true';
    const hasScoresArray = Array.isArray(event?.scores) && event.scores.length >= 2;
    if (!completedFlag) {
      return NextResponse.json(
        { error: 'Event is not completed in Odds API (completed !== true)' },
        { status: 400 }
      );
    }
    if (!hasScoresArray) {
      return NextResponse.json(
        { error: 'Scores are not available from Odds API' },
        { status: 400 }
      );
    }

    // Extract scores
    let homeScore = 0;
    let awayScore = 0;

    // Find scores by team name matching
    for (const score of event.scores as any[]) {
      if (score.name === market.home_team || score.name === event.home_team) {
        homeScore = parseInt(score.score) || 0;
      } else if (score.name === market.away_team || score.name === event.away_team) {
        awayScore = parseInt(score.score) || 0;
      }
    }

    // Fallback: use array position if team names don't match
    if (homeScore === 0 && awayScore === 0 && (event.scores as any[]).length >= 2) {
      homeScore = parseInt(event.scores[0].score) || 0;
      awayScore = parseInt(event.scores[1].score) || 0;
    }

    // Validate scores are within uint16 range
    if (homeScore < 0 || homeScore > 65535 || awayScore < 0 || awayScore > 65535) {
      return NextResponse.json(
        { error: 'Scores must be within uint16 range (0-65535)' },
        { status: 400 }
      );
    }

    // Get deployment configuration
    const deployment = getDeployment();
    if (!deployment.oracle) {
      return NextResponse.json(
        { error: 'Oracle contract not deployed' },
        { status: 500 }
      );
    }

    // Setup provider and signer
    const provider = new ethers.JsonRpcProvider(deployment.rpcUrl);
    const signer = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY!, provider);

    // Do NOT adjust scores locally. Update the market spread on-chain via Oracle before scoring.
    let submitHome = homeScore;
    let submitAway = awayScore;
    // Capture closing spread snapshot for DB update
    let closingHomeSpreadPoint: number | null = null;
    let closingAwaySpreadPoint: number | null = null;
    let closingBookmakerKey: string | null = null;
    try {
      const marketCtr = new ethers.Contract(market.market_address, MARKET_ABI, provider);
      const onchainSpreadTenths: number = Number(await marketCtr.spreadTenths());
      const appliesToHome: boolean = Boolean(await marketCtr.spreadAppliesToHome());
      const isSpreadsType = String(market.market_type || '').toLowerCase() === 'spreads';
      if (isSpreadsType) {
        // Fetch closing spread from Odds API for this event, not from DB
        const oddsApiKey = process.env.ODDS_API_KEY;
        if (!oddsApiKey) {
          throw new Error('Odds API key not configured');
        }

        const oddsUrl = new URL(`https://api.the-odds-api.com/v4/sports/${eventData.sport_key}/events/${eventId}/odds`);
        oddsUrl.searchParams.set('apiKey', oddsApiKey);
        oddsUrl.searchParams.set('regions', 'us');
        oddsUrl.searchParams.set('markets', 'spreads');
        oddsUrl.searchParams.set('oddsFormat', 'american');

        const oddsResp = await fetch(oddsUrl.toString(), { headers: { Accept: 'application/json' } });
        if (!oddsResp.ok) {
          throw new Error(`Odds upstream error ${oddsResp.status}`);
        }
        const oddsJson = await oddsResp.json();

        // The event-specific endpoint returns an object with bookmakers
        const bookmakers = Array.isArray(oddsJson?.bookmakers) ? oddsJson.bookmakers : [];
        if (bookmakers.length > 0) {
          const preferredKeys = ['fanduel', 'draftkings', 'betmgm', 'caesars', 'betrivers'];
          let bm = bookmakers.find((b: any) => preferredKeys.includes(String(b.key).toLowerCase()));
          if (!bm) bm = bookmakers[0];

          const spreads = Array.isArray(bm?.markets) ? bm.markets.find((m: any) => m?.key === 'spreads') : null;
          closingBookmakerKey = bm.key || bm.title || 'unknown';
          let home_spread_point: number | null = null;
          let away_spread_point: number | null = null;

          const homeName = market.home_team;
          const awayName = market.away_team;

          if (spreads && Array.isArray(spreads.outcomes)) {
            for (const oc of spreads.outcomes) {
              if (oc?.name === homeName && typeof oc?.point === 'number') home_spread_point = oc.point;
              if (oc?.name === awayName && typeof oc?.point === 'number') away_spread_point = oc.point;
            }
          }

          // Determine the point that applies to the fixed contract side
          const contractSideName = appliesToHome ? homeName : awayName;
          let chosenPoint: number | null = null;
          if (contractSideName === homeName) {
            chosenPoint = home_spread_point;
          } else {
            chosenPoint = away_spread_point;
          }
          // Fallback: if only the opposite side is present, invert its point
          if (chosenPoint === null) {
            const otherPoint = contractSideName === homeName ? away_spread_point : home_spread_point;
            if (typeof otherPoint === 'number') chosenPoint = -otherPoint;
          }

          if (typeof chosenPoint === 'number') {
            const tenths = Math.max(-32768, Math.min(32767, Math.round(chosenPoint * 10)));
            if (tenths !== onchainSpreadTenths) {
              const oracle = new ethers.Contract(deployment.oracle, ORACLE_ABI, signer);
              const txSpread = await oracle.setMarketSpreadTenths(market.market_address, tenths);
              console.log(`Oracle spread update tx: ${txSpread.hash} (tenths=${tenths}, appliesToHome=${appliesToHome}, point=${chosenPoint})`);
              await txSpread.wait();
            }
            // Capture for later DB update alongside final scores
            closingHomeSpreadPoint = typeof home_spread_point === 'number' ? home_spread_point : closingHomeSpreadPoint;
            closingAwaySpreadPoint = typeof away_spread_point === 'number' ? away_spread_point : closingAwaySpreadPoint;
          }
        }
      }
    } catch (spreadErr) {
      console.warn('Spread update via Oracle failed or skipped. Proceeding to report scores.', spreadErr);
    }

    // Create Oracle contract instance
    const oracle = new ethers.Contract(deployment.oracle, ORACLE_ABI, signer);

    // Verify the signer is authorized
    const isAuthorized = await oracle.authorizedReporters(signer.address);
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized: Agent is not an authorized oracle reporter' },
        { status: 403 }
      );
    }

    // Check if market is already settled on-chain
    const isSettled = await oracle.isMarketSettled(market.market_address);
    if (isSettled) {
      return NextResponse.json(
        { error: 'Market is already settled on-chain' },
        { status: 400 }
      );
    }

    console.log(`Finalizing market ${market.market_address} for event ${eventId}: home_raw=${homeScore}, away_raw=${awayScore}, submitted_home=${submitHome}, submitted_away=${submitAway}`);

    // Report scores to oracle (this settles the market immediately)
    const tx = await oracle.reportScoreForMarket(market.market_address, submitHome, submitAway);
    console.log(`Oracle finalization tx sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Oracle finalization confirmed in block ${receipt.blockNumber}`);

    // Update database with final scores
    try {
      const updatePayload: any = {
        home_score_final: submitHome,
        away_score_final: submitAway,
        scores_set: true,
        updated_at: new Date().toISOString()
      };
      if (closingBookmakerKey) updatePayload.bookmaker_key = closingBookmakerKey;
      if (closingHomeSpreadPoint !== null) updatePayload.home_spread_point = closingHomeSpreadPoint;
      if (closingAwaySpreadPoint !== null) updatePayload.away_spread_point = closingAwaySpreadPoint;
      updatePayload.last_odds_update = new Date().toISOString();

      await supabaseAdmin
        .from('x402_markets')
        .update(updatePayload)
        .eq('market_address', market.market_address);

      // Also update the event scores table if it exists
      await supabaseAdmin
        .from('x402_event_scores')
        .upsert({
          event_id: eventId,
          completed: true,
          home_team: market.home_team,
          away_team: market.away_team,
          home_score: homeScore,
          away_score: awayScore,
          submitted_home: submitHome,
          submitted_away: submitAway,
          last_update: new Date().toISOString(),
          scores_json: event.scores
        }, {
          onConflict: 'event_id'
        });
    } catch (dbError) {
      console.warn('Database update failed:', dbError);
      // Don't fail the request since the on-chain settlement succeeded
    }

    return NextResponse.json({
      success: true,
      eventId,
      marketAddress: market.market_address,
      scores: {
        home: homeScore,
        away: awayScore
      },
      transactionHash: tx.hash,
      blockNumber: receipt.blockNumber,
      payment: {
        txHash: paymentTxHash,
        payer: paymentResult.payer,
        recipient: paymentResult.recipient,
        amountWei: paymentResult.amountWei
      }
    });

  } catch (error: any) {
    console.error('Game finalization error:', error);
    
    // Handle specific error types
    if (error.code === 'CALL_EXCEPTION') {
      return NextResponse.json(
        { error: 'Contract call failed: ' + error.reason },
        { status: 400 }
      );
    }
    
    if (error.code === 'INSUFFICIENT_FUNDS') {
      return NextResponse.json(
        { error: 'Insufficient funds for gas' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Finalization failed: ' + error.message },
      { status: 500 }
    );
  }
}