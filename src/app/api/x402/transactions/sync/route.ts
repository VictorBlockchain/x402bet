import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { getDeployment } from '@/lib/config/deployment'
import { buildSlug } from '@/lib/utils/slug'
import { supabaseAdmin } from '@/lib/supabase/client'

// ABIs to parse relevant events from Factory, Market, Oracle
const FACTORY_ABI = [
  'event MarketCreated(address indexed market, uint64 eventId, uint8 tokenType, address token)',
  'event GameRegistered(bytes32 indexed key, string sport, string region, string proposition, string homeVsAway, address market)'
]

const MARKET_ABI = [
  'function eventId() view returns (uint64)',
  'event BetPlaced(address indexed bettor, uint16 indexed selectionId, uint256 stake, uint256 fee)',
  'event Settled(uint16 indexed winningSelection, uint256 totalPool, uint256 winningPool, uint256 payoutMultiplier)',
  'event ScoresSet(uint16 homeScore, uint16 awayScore, bool isPush, uint16 winningSelection)',
  'event Claimed(address indexed bettor, uint256 payout)'
]

const ORACLE_ABI = [
  'event ScoreReported(uint64 eventId, uint16 homeScore, uint16 awayScore, address reporter)',
  'event MarketSettled(address market, uint64 eventId, uint16 homeScore, uint16 awayScore)'
]

type SyncBody = {
  txHash: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SyncBody
    if (!body || typeof body !== 'object' || !body.txHash || typeof body.txHash !== 'string') {
      return NextResponse.json({ error: 'txHash required' }, { status: 400 })
    }

    const txHash = body.txHash
    const DEPLOY = getDeployment()
    const provider = new ethers.JsonRpcProvider(DEPLOY.rpcUrl)
    const receipt = await provider.getTransactionReceipt(txHash)
    if (!receipt) {
      return NextResponse.json({ error: 'Transaction receipt not found yet' }, { status: 404 })
    }

    const factoryIface = new ethers.Interface(FACTORY_ABI)
    const marketIface = new ethers.Interface(MARKET_ABI)
    const oracleIface = new ethers.Interface(ORACLE_ABI)

    const factoryAddr = DEPLOY.factory ? ethers.getAddress(DEPLOY.factory) : undefined

    // Group parsed events by eventId for DB updates
    const updates: Record<string, any[]> = {}

    // Helper to add an onchain log to an eventId bucket
    const pushUpdate = (eid: number | string, payload: any) => {
      const key = String(eid)
      if (!updates[key]) updates[key] = []
      updates[key].push({ ...payload, txHash, blockNumber: Number(receipt.blockNumber || 0), chainId: DEPLOY.chainId })
    }

    for (const log of receipt.logs || []) {
      try {
        // Factory-origin logs
        if (factoryAddr && (log as any).address?.toLowerCase() === factoryAddr.toLowerCase()) {
          const parsed = (() => { try { return factoryIface.parseLog(log) } catch { return null } })()
          if (!parsed) continue
          if (parsed.name === 'MarketCreated') {
            const market = ethers.getAddress(parsed.args[0] as string)
            const eid = Number(parsed.args[1] as bigint)
            const tokenType = Number(parsed.args[2] as number)
            const token = ethers.getAddress(parsed.args[3] as string)
            pushUpdate(eid, { type: 'MarketCreated', market, tokenType, token })
          } else if (parsed.name === 'GameRegistered') {
            const key = parsed.args[0] as string
            const sport = parsed.args[1] as string
            const region = parsed.args[2] as string
            const proposition = parsed.args[3] as string
            const homeVsAway = parsed.args[4] as string
            const market = ethers.getAddress(parsed.args[5] as string)
            // Resolve eventId from market
            try {
              const m = new ethers.Contract(market, MARKET_ABI, provider)
              const eid: number = Number(await m.eventId())
              pushUpdate(eid, { type: 'GameRegistered', key, sport, region, proposition, homeVsAway, market })
            } catch {}
          }
          continue
        }

        // Market-origin logs
        const parsedMarket = (() => { try { return marketIface.parseLog(log) } catch { return null } })()
        if (parsedMarket) {
          const marketAddr = ethers.getAddress((log as any).address)
          let eid = undefined
          try {
            const m = new ethers.Contract(marketAddr, MARKET_ABI, provider)
            eid = Number(await m.eventId())
          } catch {}
          if (eid === undefined) continue
          if (parsedMarket.name === 'BetPlaced') {
            const bettor = parsedMarket.args[0] as string
            const selectionId = Number(parsedMarket.args[1] as number)
            const stakeWei = parsedMarket.args[2] as bigint
            const feeWei = parsedMarket.args[3] as bigint
            pushUpdate(eid, { type: 'BetPlaced', market: marketAddr, bettor: ethers.getAddress(bettor), selectionId, stakeWei: stakeWei.toString(), feeWei: feeWei.toString() })
          } else if (parsedMarket.name === 'Settled') {
            const winningSelection = Number(parsedMarket.args[0] as number)
            const totalPool = parsedMarket.args[1] as bigint
            const winningPool = parsedMarket.args[2] as bigint
            const payoutMultiplier = parsedMarket.args[3] as bigint
            pushUpdate(eid, { type: 'Settled', market: marketAddr, winningSelection, totalPool: totalPool.toString(), winningPool: winningPool.toString(), payoutMultiplier: payoutMultiplier.toString() })
          } else if (parsedMarket.name === 'ScoresSet') {
            const homeScore = Number(parsedMarket.args[0] as number)
            const awayScore = Number(parsedMarket.args[1] as number)
            const isPush = Boolean(parsedMarket.args[2] as boolean)
            const winningSelection = Number(parsedMarket.args[3] as number)
            pushUpdate(eid, { type: 'ScoresSet', market: marketAddr, homeScore, awayScore, isPush, winningSelection })
          } else if (parsedMarket.name === 'Claimed') {
            const bettor = parsedMarket.args[0] as string
            const payout = parsedMarket.args[1] as bigint
            pushUpdate(eid, { type: 'Claimed', market: marketAddr, bettor: ethers.getAddress(bettor), payout: payout.toString() })
          }
          continue
        }

        // Oracle-origin logs
        const parsedOracle = (() => { try { return oracleIface.parseLog(log) } catch { return null } })()
        if (parsedOracle) {
          if (parsedOracle.name === 'ScoreReported') {
            const eid = Number(parsedOracle.args[0] as bigint)
            const homeScore = Number(parsedOracle.args[1] as number)
            const awayScore = Number(parsedOracle.args[2] as number)
            const reporter = ethers.getAddress(parsedOracle.args[3] as string)
            pushUpdate(eid, { type: 'ScoreReported', homeScore, awayScore, reporter })
          } else if (parsedOracle.name === 'MarketSettled') {
            const market = ethers.getAddress(parsedOracle.args[0] as string)
            const eid = Number(parsedOracle.args[1] as bigint)
            const homeScore = Number(parsedOracle.args[2] as number)
            const awayScore = Number(parsedOracle.args[3] as number)
            pushUpdate(eid, { type: 'MarketSettled', market, homeScore, awayScore })
          }
          continue
        }
      } catch {}
    }

    // Persist updates per eventId into x402_events.metadata.onchain.logs
    const results: Record<string, { updated: boolean; marketsUpserted?: number }> = {}
    for (const [eid, logs] of Object.entries(updates)) {
      try {
        const existing = await supabaseAdmin
          .from('x402_events')
          .select('metadata, sport_key, home_team, away_team, commence_time')
          .eq('id', eid)
          .maybeSingle()

        const priorMeta = (existing?.data?.metadata as any) || {}
        const onchain = priorMeta.onchain || {}
        const prev = Array.isArray(onchain.logs) ? onchain.logs : []
        const merged = [...prev, ...logs]
        const nextMeta = { ...priorMeta, onchain: { ...onchain, logs: merged, lastTxHash: txHash } }
        await supabaseAdmin.from('x402_events').update({ metadata: nextMeta }).eq('id', eid)
        // Build market row if we have Factory events
        let upsertCount = 0
        const sportKey = existing?.data?.sport_key as string | undefined
        const homeTeam = existing?.data?.home_team as string | undefined
        const awayTeam = existing?.data?.away_team as string | undefined
        const commenceTime = existing?.data?.commence_time as string | undefined
        const gameReg = logs.find(l => l.type === 'GameRegistered')
        const mktCreated = logs.find(l => l.type === 'MarketCreated')
        const factoryAddr = getDeployment().factory ? ethers.getAddress(getDeployment().factory!) : undefined
        if (mktCreated) {
          const marketAddr = ethers.getAddress(mktCreated.market)
          const tokenTypeNum = Number(mktCreated.tokenType || 0)
          const tokenType = tokenTypeNum === 1 ? 'erc20' : 'native'
          const tokenAddr = mktCreated.token ? ethers.getAddress(mktCreated.token) : null
          // Derive slug and market_type
          let slug: string | null = null
          let marketType: string = 'h2h'
          let region: string | null = null
          let proposition: string | null = null
          let homeVsAway: string | null = null
          if (gameReg) {
            const sport = String(gameReg.sport || '')
            region = String(gameReg.region || '')
            proposition = String(gameReg.proposition || '')
            homeVsAway = String(gameReg.homeVsAway || '')
            const [homeRaw, awayRaw] = String(homeVsAway).split(':')
            slug = buildSlug(sport, region, proposition, homeRaw || '', awayRaw || '')
            if (proposition?.includes('spread')) marketType = 'spreads'
            else if (proposition?.includes('total')) marketType = 'totals'
          }
          // Upsert market row keyed by market_address
          const row: any = {
            sport_key: sportKey || (gameReg?.sport || 'any'),
            event_id: String(eid),
            slug,
            market_type: marketType,
            home_team: homeTeam || undefined,
            away_team: awayTeam || undefined,
            market_address: marketAddr,
            factory: factoryAddr,
            contract_event_id: Number(eid),
            token_type: tokenType,
            token: tokenAddr,
            start_time: commenceTime || null,
            cutoff_time: commenceTime || null,
            last_onchain_sync: new Date().toISOString(),
          }
          await supabaseAdmin.from('x402_markets').upsert(row, { onConflict: 'market_address' })
          upsertCount += 1
        }
        results[eid] = { updated: true, marketsUpserted: upsertCount }
      } catch (e) {
        results[eid] = { updated: false, marketsUpserted: 0 }
      }
    }

    return NextResponse.json({ ok: true, results, count: Object.keys(updates).length })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'sync failed' }, { status: 500 })
  }
}