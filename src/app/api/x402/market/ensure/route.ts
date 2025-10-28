import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { getDeployment } from '@/lib/config/deployment'

type EnsureBody = {
  agent: string
  eventId: number // uint64
  homeSelectionId: number // uint16
  awaySelectionId: number // uint16
  spreadTenths: number // int16 (e.g., +35 => +3.5)
  spreadAppliesToHome: boolean
  sport: string
  region: string
  proposition: string
  homeVsAway: string // "home:away" lower or mixed case, normalized on chain
  startTime?: number // uint64 epoch seconds (optional)
  cutoffTime?: number // uint64 epoch seconds (optional)
  initialSelection: string // 'home' | 'away' | numeric string (uint16 id)
  tokenType: 'native' | 'erc20'
  amount: string // smallest units: wei for native, token units for ERC20
}

const DEPLOYMENT = getDeployment()
const addressRegex = /^0x[a-fA-F0-9]{40}$/

function isChecksummedAddress(addr?: string): boolean {
  try {
    if (!addr || !addressRegex.test(addr)) return false
    ethers.getAddress(addr)
    return true
  } catch {
    return false
  }
}

// Minimal ABI to read and create markets from Factory
const FACTORY_ABI = [
  'function marketByEventId(uint64 eventId) view returns (address)',
  'function marketBySlug(bytes32 key) view returns (address)',
  'function createMarket(uint64 eventId, uint16 homeSelectionId, uint16 awaySelectionId, int16 spreadTenths, bool spreadAppliesToHome, string sport, string region, string proposition, string homeVsAway, uint64 startTime, uint64 cutoffTime, uint16 initialSelectionId, uint256 amount) payable returns (address)'
]

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as EnsureBody
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const { agent, eventId, homeSelectionId, awaySelectionId, spreadTenths, spreadAppliesToHome, sport, region, proposition, homeVsAway, startTime, cutoffTime, initialSelection, tokenType, amount } = body

    if (!isChecksummedAddress(agent)) {
      return NextResponse.json({ error: 'Invalid agent address' }, { status: 400 })
    }
    if (!Number.isInteger(eventId) || eventId < 0 || eventId > Number.MAX_SAFE_INTEGER) {
      return NextResponse.json({ error: 'Invalid eventId (uint64)' }, { status: 400 })
    }
    if (!Number.isInteger(homeSelectionId) || homeSelectionId < 0 || homeSelectionId > 65535) {
      return NextResponse.json({ error: 'Invalid homeSelectionId (uint16)' }, { status: 400 })
    }
    if (!Number.isInteger(awaySelectionId) || awaySelectionId < 0 || awaySelectionId > 65535) {
      return NextResponse.json({ error: 'Invalid awaySelectionId (uint16)' }, { status: 400 })
    }
    if (!Number.isInteger(spreadTenths) || spreadTenths < -32768 || spreadTenths > 32767) {
      return NextResponse.json({ error: 'Invalid spreadTenths (int16 bounds)' }, { status: 400 })
    }
    if (typeof spreadAppliesToHome !== 'boolean') {
      return NextResponse.json({ error: 'Invalid spreadAppliesToHome (boolean)' }, { status: 400 })
    }
    for (const s of [sport, region, proposition, homeVsAway]) {
      if (!s || typeof s !== 'string') return NextResponse.json({ error: 'Invalid text fields' }, { status: 400 })
    }
    // Optional timing fields: if provided, must be uint64 epoch seconds
    let startTimeUint: number = 0
    let cutoffTimeUint: number = 0
    if (startTime !== undefined && startTime !== null) {
      const st = Number(startTime)
      if (!Number.isInteger(st) || st < 0 || st > Number.MAX_SAFE_INTEGER) {
        return NextResponse.json({ error: 'Invalid startTime (uint64 epoch seconds)' }, { status: 400 })
      }
      startTimeUint = st
    }
    if (cutoffTime !== undefined && cutoffTime !== null) {
      const ct = Number(cutoffTime)
      if (!Number.isInteger(ct) || ct < 0 || ct > Number.MAX_SAFE_INTEGER) {
        return NextResponse.json({ error: 'Invalid cutoffTime (uint64 epoch seconds)' }, { status: 400 })
      }
      cutoffTimeUint = ct
    }
    if (!amount || typeof amount !== 'string') {
      return NextResponse.json({ error: 'Missing amount (string)' }, { status: 400 })
    }
    if (tokenType !== 'native' && tokenType !== 'erc20') {
      return NextResponse.json({ error: 'Invalid tokenType' }, { status: 400 })
    }

    const provider = new ethers.JsonRpcProvider(DEPLOYMENT.rpcUrl)
    const factory = new ethers.Contract(DEPLOYMENT.factory, FACTORY_ABI, provider)

    // Check existence first by eventId
    const existingByEvent: string = await factory.marketByEventId(eventId)
    if (existingByEvent && existingByEvent !== ethers.ZeroAddress) {
      return NextResponse.json({ exists: true, market: ethers.getAddress(existingByEvent) })
    }

    // Also check existence by slug: keccak256(lower(sport)+":"+lower(region)+":"+lower(proposition)+":"+lower(home)+":"+lower(away))
    const sportLower = String(sport || '').trim().toLowerCase()
    const regionLower = String(region || '').trim().toLowerCase()
    const propLower = String(proposition || '').trim().toLowerCase()
    const hvaLower = String(homeVsAway || '').trim().toLowerCase()
    const slugStr = `${sportLower}:${regionLower}:${propLower}:${hvaLower}`
    const slugKey = ethers.keccak256(ethers.toUtf8Bytes(slugStr))
    const existingBySlug: string = await factory.marketBySlug(slugKey)
    if (existingBySlug && existingBySlug !== ethers.ZeroAddress) {
      return NextResponse.json({ exists: true, market: ethers.getAddress(existingBySlug) })
    }

    // Map initial selection
    let initialSelectionId: number
    const selLower = String(initialSelection || '').trim().toLowerCase()
    if (selLower === 'home') initialSelectionId = homeSelectionId
    else if (selLower === 'away') initialSelectionId = awaySelectionId
    else {
      const parsed = Number(initialSelection)
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
        return NextResponse.json({ error: 'Invalid initialSelection (expect "home" | "away" or uint16 id)' }, { status: 400 })
      }
      initialSelectionId = parsed
    }

    // Encode createMarket call
    const iface = new ethers.Interface(FACTORY_ABI)
    const data = iface.encodeFunctionData('createMarket', [
      eventId,
      homeSelectionId,
      awaySelectionId,
      spreadTenths,
      spreadAppliesToHome,
      sport,
      region,
      proposition,
      homeVsAway,
      startTimeUint,
      cutoffTimeUint,
      initialSelectionId,
      amount
    ])

    const tx = {
      to: ethers.getAddress(DEPLOYMENT.factory!),
      data,
      value: tokenType === 'native' ? amount : undefined,
    } as { to: string; data: string; value?: string }

    // Fee data and gas estimate
    let feeData: any = {}
    try {
      const f = await provider.getFeeData()
      feeData = {
        maxFeePerGas: f.maxFeePerGas?.toString() || undefined,
        maxPriorityFeePerGas: f.maxPriorityFeePerGas?.toString() || undefined,
      }
    } catch {}

    let gasEstimate: string | undefined
    try {
      const est = await provider.estimateGas({
        from: ethers.getAddress(agent),
        to: tx.to,
        data: tx.data,
        value: tx.value ? ethers.toBigInt(tx.value) : undefined,
      })
      gasEstimate = est.toString()
    } catch {
      gasEstimate = undefined
    }

    // Skip simulation: factory create+seed may rely on caller state (balances/allowances)
    // The verification route will gate target addresses; execution errors will surface on-chain.

    return NextResponse.json({
      exists: false,
      factory: ethers.getAddress(DEPLOYMENT.factory!),
      network: DEPLOYMENT.network,
      tx,
      feeData,
      gasEstimate,
      syncEndpoint: '/api/x402/transactions/sync',
      notes: tokenType === 'erc20' ? 'Ensure factory is approved as spender for x402Bet tokens before sending.' : undefined,
    })
  } catch (e: any) {
    // Provide richer error details to aid debugging in dev
    const detail = {
      message: e?.message || undefined,
      name: e?.name || undefined,
      stack: e?.stack || undefined,
    }
    return NextResponse.json({ error: 'Ensure route failed', detail }, { status: 500 })
  }
}