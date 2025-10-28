import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { getDeployment } from '@/lib/config/deployment'

type VerifyBody = {
  agent: string
  tx: {
    to: string
    data: string
    value?: string
    gas?: string
    maxFeePerGas?: string
    maxPriorityFeePerGas?: string
  }
  slippageBps?: number
  paymentRequirements?: { network: string }
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

// Only allow calls to the factory or to markets recognized by Factory.isMarket
async function isAllowedTarget(addr?: string): Promise<boolean> {
  if (!isChecksummedAddress(addr)) return false
  try {
    const to = ethers.getAddress(addr!)
    // Allow direct calls to the Factory contract
    if (DEPLOYMENT.factory && ethers.getAddress(DEPLOYMENT.factory) === to) return true
    // Otherwise, require on-chain market recognition
    const provider = new ethers.JsonRpcProvider(DEPLOYMENT.rpcUrl)
    const FACTORY_ABI = ['function isMarket(address a) view returns (bool)']
    const factory = new ethers.Contract(ethers.getAddress(DEPLOYMENT.factory!), FACTORY_ABI, provider)
    const ok: boolean = await factory.isMarket(to)
    return ok
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as VerifyBody
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const { agent, tx, slippageBps, paymentRequirements } = body

    if (!isChecksummedAddress(agent)) {
      return NextResponse.json({ error: 'Invalid agent address' }, { status: 400 })
    }
    if (!tx || typeof tx !== 'object') {
      return NextResponse.json({ error: 'Invalid tx payload' }, { status: 400 })
    }
    if (!isChecksummedAddress(tx.to)) {
      return NextResponse.json({ error: 'Invalid tx.to address' }, { status: 400 })
    }
    if (!tx.data || typeof tx.data !== 'string') {
      return NextResponse.json({ error: 'Invalid tx.data' }, { status: 400 })
    }
    if (typeof slippageBps === 'number') {
      if (slippageBps < 0 || slippageBps > 500) {
        return NextResponse.json({ error: 'slippageBps out of bounds' }, { status: 400 })
      }
    }

    // Network gating
    const requiredNet = paymentRequirements?.network
    if (requiredNet && requiredNet !== DEPLOYMENT.network) {
      return NextResponse.json({ error: 'Network mismatch' }, { status: 400 })
    }

    // Factory-based authorization only
    if (!(await isAllowedTarget(tx.to))) {
      return NextResponse.json({ error: 'Target not whitelisted' }, { status: 403 })
    }

    const provider = new ethers.JsonRpcProvider(DEPLOYMENT.rpcUrl)

    // For factory calls, skip simulation: may depend on caller balances/allowances
    const isFactoryCall = DEPLOYMENT.factory && ethers.getAddress(DEPLOYMENT.factory) === ethers.getAddress(tx.to)
    if (!isFactoryCall) {
      // Simulation-first preflight for market/bet calls
      try {
        await provider.call({
          from: ethers.getAddress(agent),
          to: ethers.getAddress(tx.to),
          data: tx.data,
          value: tx.value ? ethers.toBigInt(tx.value) : undefined,
        })
      } catch (e: any) {
        return NextResponse.json(
          { isValid: false, payer: ethers.getAddress(agent), reason: e?.message || 'call reverted' },
          { status: 400 },
        )
      }
    }

    return NextResponse.json({ isValid: true, payer: ethers.getAddress(agent) })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}