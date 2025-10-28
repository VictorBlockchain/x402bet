import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { verifySeiPayment } from '@/lib/payments/sei'
import { getDeployment } from '@/lib/config/deployment'
import { supabaseAdmin } from '@/lib/supabase/client'

// Oracle ABI: authorize check and spread setter
const ORACLE_ABI = [
  'function authorizedReporters(address reporter) view returns (bool)',
  'function setMarketSpreadTenths(address market, int16 newSpreadTenths) external'
]

// Minimal Market ABI to read spread side
const MARKET_ABI = [
  'function spreadAppliesToHome() view returns (bool)',
  'function spreadTenths() view returns (int16)'
]

type Body = {
  market: string
  point: number | string
  paymentTxHash: string
  agent?: string
  side?: 'home' | 'away' | string
}

export async function POST(req: NextRequest) {
  try {
    const { market, point, paymentTxHash, agent, side } = (await req.json()) as Body

    // Validate params
    if (!market || !paymentTxHash || (point === undefined || point === null)) {
      return NextResponse.json(
        { error: 'Missing required fields: market, point, paymentTxHash' },
        { status: 400 }
      )
    }

    const addressRegex = /^0x[a-fA-F0-9]{40}$/
    if (!addressRegex.test(String(market))) {
      return NextResponse.json(
        { error: 'Invalid market address' },
        { status: 400 }
      )
    }

    const pointNum = typeof point === 'string' ? Number(point) : point
    if (!Number.isFinite(pointNum)) {
      return NextResponse.json(
        { error: 'Invalid point (must be a finite number)' },
        { status: 400 }
      )
    }

    const sideStr = typeof side === 'string' ? side.trim().toLowerCase() : undefined
    if (sideStr && sideStr !== 'home' && sideStr !== 'away') {
      return NextResponse.json(
        { error: 'Invalid side (must be "home" or "away")' },
        { status: 400 }
      )
    }

    // Verify $0.01 payment
    const pay = await verifySeiPayment(paymentTxHash, agent, 0.01)
    if (!pay.ok) {
      return NextResponse.json(
        { error: 'Payment verification failed', reason: pay.reason },
        { status: 402 }
      )
    }

    const DEPLOYMENT = getDeployment()
    if (!DEPLOYMENT.oracle || !DEPLOYMENT.rpcUrl) {
      return NextResponse.json(
        { error: 'Deployment not configured (oracle/rpcUrl missing)' },
        { status: 500 }
      )
    }

    const priv = (process.env.AGENT_PRIVATE_KEY || '').trim()
    if (!priv) {
      return NextResponse.json(
        { error: 'Server agent key not configured' },
        { status: 500 }
      )
    }

    const provider = new ethers.JsonRpcProvider(DEPLOYMENT.rpcUrl)
    const signer = new ethers.Wallet(priv, provider)

    const oracle = new ethers.Contract(DEPLOYMENT.oracle, ORACLE_ABI, signer)

    // Gate by authorized reporter
    const isAuth: boolean = await oracle.authorizedReporters(signer.address)
    if (!isAuth) {
      return NextResponse.json(
        { error: 'Unauthorized: agent is not an authorized oracle reporter' },
        { status: 403 }
      )
    }

    // Determine which side the spread applies to and current on-chain spread
    const marketCtr = new ethers.Contract(ethers.getAddress(market), MARKET_ABI, provider)
    const appliesToHome: boolean = Boolean(await marketCtr.spreadAppliesToHome())
    const currentTenths: number = Number(await marketCtr.spreadTenths())

    // Normalize point to the market's configured side and preserve sign.
    // If caller provides the opposite side, flip the sign to map.
    // Example: if spreadAppliesToHome == true and side == 'away', use -point.
    const normalizedPoint = ((): number => {
      if (!sideStr) return pointNum
      if (appliesToHome) {
        return sideStr === 'home' ? pointNum : -pointNum
      } else {
        return sideStr === 'away' ? pointNum : -pointNum
      }
    })()

    // Convert to tenths with sign, clamp to int16
    const tenths = Math.max(-32768, Math.min(32767, Math.round(normalizedPoint * 10)))

    // Skip if already set to desired value
    let txHash: string | undefined
    if (tenths !== currentTenths) {
      const tx = await oracle.setMarketSpreadTenths(ethers.getAddress(market), tenths)
      txHash = tx.hash
      await tx.wait()
    }

    // Try to update DB snapshot for visibility
    let dbUpdated = false
    try {
      const homePoint = appliesToHome ? normalizedPoint : -normalizedPoint
      const awayPoint = -homePoint
      const { error } = await supabaseAdmin
        .from('x402_markets')
        .update({
          home_spread_point: homePoint,
          away_spread_point: awayPoint,
          updated_at: new Date().toISOString(),
        })
        .eq('market_address', ethers.getAddress(market))
      dbUpdated = !error
    } catch {}

    return NextResponse.json({
      ok: true,
      market: ethers.getAddress(market),
      point: pointNum,
      side: sideStr || (appliesToHome ? 'home' : 'away'),
      normalizedPoint,
      tenths,
      appliesToHome,
      txHash,
      payment: { from: pay.payer, to: pay.recipient, valueWei: pay.amountWei, network: pay.network },
      dbUpdated,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}