import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { getDeployment } from '@/lib/config/deployment'
import { supabaseAdmin } from '@/lib/supabase/client'

// Minimal ABI with Factory events we care about
const FACTORY_EVENT_ABI = [
  // enum compiles to uint8 in ABI
  'event MarketCreated(address indexed market, uint64 eventId, uint8 tokenType, address token)',
  'event GameRegistered(bytes32 indexed key, string sport, string region, string proposition, string homeVsAway, address market)'
]

type CreateEventBody = {
  txHash?: string
  eventId?: number
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateEventBody
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const { txHash, eventId } = body
    if (!txHash || typeof txHash !== 'string' || !txHash.startsWith('0x')) {
      return NextResponse.json({ error: 'txHash required' }, { status: 400 })
    }

    const DEPLOY = getDeployment()
    if (!DEPLOY.factory) {
      return NextResponse.json({ error: 'Factory address not configured' }, { status: 500 })
    }

    const provider = new ethers.JsonRpcProvider(DEPLOY.rpcUrl)
    const receipt = await provider.getTransactionReceipt(txHash)
    if (!receipt) {
      return NextResponse.json({ error: 'Transaction receipt not found yet' }, { status: 404 })
    }

    const iface = new ethers.Interface(FACTORY_EVENT_ABI)
    const factoryAddr = ethers.getAddress(DEPLOY.factory)

    let marketCreated:
      | { market: string; eventId: number; tokenType: number; token: string; txHash: string; blockNumber: number }
      | undefined
    let gameRegistered:
      | { key: string; sport: string; region: string; proposition: string; homeVsAway: string; market: string }
      | undefined

    for (const log of receipt.logs || []) {
      try {
        if (!log || (log as any).address?.toLowerCase() !== factoryAddr.toLowerCase()) continue
        const parsed = (() => {
          try {
            return iface.parseLog(log)
          } catch {
            return null
          }
        })()
        if (!parsed) continue
        if (parsed.name === 'MarketCreated') {
          const mkt = parsed.args[0] as string
          const evId = Number(parsed.args[1] as bigint)
          const tokType = Number(parsed.args[2] as number)
          const token = parsed.args[3] as string
          marketCreated = {
            market: ethers.getAddress(mkt),
            eventId: evId,
            tokenType: tokType,
            token: ethers.getAddress(token),
            txHash,
            blockNumber: Number(receipt.blockNumber || 0),
          }
        } else if (parsed.name === 'GameRegistered') {
          const key = parsed.args[0] as string
          const sport = parsed.args[1] as string
          const region = parsed.args[2] as string
          const proposition = parsed.args[3] as string
          const homeVsAway = parsed.args[4] as string
          const market = parsed.args[5] as string
          gameRegistered = {
            key,
            sport,
            region,
            proposition,
            homeVsAway,
            market: ethers.getAddress(market),
          }
        }
      } catch {}
    }

    if (!marketCreated && !gameRegistered) {
      return NextResponse.json({ error: 'No Factory events found in receipt' }, { status: 404 })
    }

    // If we have an eventId, sync the events table metadata for cross-linking
    if (eventId && Number.isFinite(eventId)) {
      try {
        const eid = String(eventId)
        const existing = await supabaseAdmin
          .from('x402_events')
          .select('metadata')
          .eq('id', eid)
          .maybeSingle()

        const priorMeta = (existing?.data?.metadata as any) || {}
        const onchain = {
          ...(priorMeta?.onchain || {}),
          marketAddress: marketCreated?.market || gameRegistered?.market,
          slugKey: gameRegistered?.key,
          tokenType: marketCreated?.tokenType,
          token: marketCreated?.token,
          txHash,
          blockNumber: Number(receipt.blockNumber || 0),
          factory: factoryAddr,
          chainId: DEPLOY.chainId,
        }

        const nextMeta = { ...priorMeta, onchain }
        await supabaseAdmin.from('x402_events').update({ metadata: nextMeta }).eq('id', eid)
      } catch (e) {
        // Non-fatal: event row may not exist in DB yet
        console.warn('Supabase event metadata sync failed:', (e as any)?.message)
      }
    }

    return NextResponse.json({
      ok: true,
      network: DEPLOY.network,
      factory: factoryAddr,
      marketCreated,
      gameRegistered,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'sync failed' }, { status: 500 })
  }
}