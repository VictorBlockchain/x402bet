import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { getDeployment } from '@/lib/config/deployment';
import { supabaseAdmin } from '@/lib/supabase/client'

// Oracle ABI for settlement functions (matches Oracle.sol)
const ORACLE_ABI = [
  "function authorizedReporters(address reporter) view returns (bool)",
  "function reportScoreForMarket(address market, uint16 homeScore, uint16 awayScore) external",
  "function settleMarketByAddress(address market) external",
  "function getMarketScore(address market) view returns (uint16 homeScore, uint16 awayScore, bool isSet, uint64 timestamp)",
  "function isMarketSettled(address market) view returns (bool)",
  "function getMarketScores(address market) view returns (uint16 homeScore, uint16 awayScore, bool settled)"
];

export async function POST(request: NextRequest) {
  try {
    const { marketAddress, scores } = await request.json();

    if (!marketAddress || !scores || !Array.isArray(scores)) {
      return NextResponse.json(
        { error: 'Missing required fields: marketAddress, scores' },
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
    const pk = (process.env.AGENT_PRIVATE_KEY || '').trim()
    if (!pk) {
      return NextResponse.json({ error: 'Missing AGENT_PRIVATE_KEY for oracle settlement' }, { status: 500 })
    }
    const signer = new ethers.Wallet(pk, provider)

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

    // Check if market is already settled
    const isSettled = await oracle.isMarketSettled(marketAddress);
    if (isSettled) {
      return NextResponse.json(
        { error: 'Market is already settled' },
        { status: 400 }
      );
    }

    // Validate and format scores: expect [homeScore, awayScore] as uint16
    if (scores.length !== 2) {
      return NextResponse.json(
        { error: 'scores must be an array of [homeScore, awayScore]' },
        { status: 400 }
      );
    }
    const homeScore = Number(scores[0]);
    const awayScore = Number(scores[1]);
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
      return NextResponse.json(
        { error: 'scores must be finite numbers' },
        { status: 400 }
      );
    }
    if (homeScore < 0 || homeScore > 65535 || awayScore < 0 || awayScore > 65535) {
      return NextResponse.json(
        { error: 'scores must be uint16 (0..65535)' },
        { status: 400 }
      );
    }

    console.log(`Reporting market ${marketAddress} scores: home=${homeScore}, away=${awayScore}`);

    // Report scores on the oracle (address-first; settles immediately)
    const tx = await oracle.reportScoreForMarket(marketAddress, homeScore, awayScore);
    console.log(`ReportScore tx sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`ReportScore confirmed in block ${receipt.blockNumber}`);

    // Sync DB: append onchain log to x402_events.metadata
    try {
      // Fetch eventId from market for DB indexing (if needed)
      const MARKET_ABI = ["function eventId() view returns (uint64)"]
      const market = new ethers.Contract(marketAddress, MARKET_ABI, provider)
      const eidNum: bigint = await market.eventId().catch(() => 0n)
      const eid = String(eidNum)
      const existing = await supabaseAdmin
        .from('x402_events')
        .select('metadata')
        .eq('id', eid)
        .maybeSingle()
      const priorMeta = (existing?.data?.metadata as any) || {}
      const onchain = priorMeta.onchain || {}
      const prevLogs = Array.isArray(onchain.logs) ? onchain.logs : []
      const nextLogs = [
        ...prevLogs,
        { type: 'ScoreReportedForMarket', market: marketAddress, homeScore, awayScore, reporter: (await signer.getAddress()), txHash: tx.hash, blockNumber: Number(receipt.blockNumber || 0) }
      ]
      const nextMeta = { ...priorMeta, onchain: { ...onchain, logs: nextLogs, lastTxHash: tx.hash } }
      await supabaseAdmin.from('x402_events').update({ metadata: nextMeta }).eq('id', eid)
    } catch (e) {
      console.warn('Supabase sync (ScoreReported) failed:', (e as any)?.message)
    }

    // No extra settlement call needed; reportScoreForMarket already settles

    return NextResponse.json({
      success: true,
      transactionHash: tx.hash,
      blockNumber: receipt.blockNumber,
      marketAddress,
      scores: [homeScore, awayScore],
      // Include eventId for convenience if available via market
      eventId: Number((await (new ethers.Contract(marketAddress, ["function eventId() view returns (uint64)"], provider)).eventId().catch(() => 0n)))
    });

  } catch (error: any) {
    console.error('Oracle settlement error:', error);
    
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
      { error: 'Settlement failed: ' + error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const marketAddress = searchParams.get('market');

    if (!marketAddress) {
      return NextResponse.json(
        { error: 'Missing market address parameter' },
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

    // Setup provider
    const provider = new ethers.JsonRpcProvider(deployment.rpcUrl);

    // Create Oracle contract instance
    const oracle = new ethers.Contract(deployment.oracle, ORACLE_ABI, provider);

    // Get market settlement status and scores
    const [isSettled, marketScores] = await Promise.all([
      oracle.isMarketSettled(marketAddress),
      oracle.getMarketScores(marketAddress).catch(() => [0, 0, false])
    ]);

    const homeScore = Number(marketScores[0] || 0);
    const awayScore = Number(marketScores[1] || 0);
    const settledFlag = Boolean(marketScores[2] || false);

    return NextResponse.json({
      marketAddress,
      isSettled,
      homeScore,
      awayScore,
      settled: settledFlag,
      oracleAddress: deployment.oracle
    });

  } catch (error: any) {
    console.error('Oracle status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check settlement status: ' + error.message },
      { status: 500 }
    );
  }
}