import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { getDeployment } from '@/lib/config/deployment'

type PrepareBody = {
  agent: string
  market: string
  selection: string // 'home' | 'away' | numeric string (uint16)
  tokenType: 'native' | 'erc20'
  amount: string // wei amount; for native this is value, for erc20 it's parameter
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

// Authorize strictly via Factory.isMarket (no static whitelist)
async function isAllowedMarket(addr?: string): Promise<boolean> {
  if (!isChecksummedAddress(addr)) return false
  try {
    const provider = new ethers.JsonRpcProvider(DEPLOYMENT.rpcUrl)
    const FACTORY_ABI = ['function isMarket(address a) view returns (bool)']
    const factory = new ethers.Contract(ethers.getAddress(DEPLOYMENT.factory!), FACTORY_ABI, provider)
    const ok: boolean = await factory.isMarket(ethers.getAddress(addr!))
    return ok
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PrepareBody

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const { agent, market, selection, tokenType, amount } = body

    if (!isChecksummedAddress(agent)) {
      return NextResponse.json({ error: 'Invalid agent address' }, { status: 400 })
    }
    if (!isChecksummedAddress(market)) {
      return NextResponse.json({ error: 'Invalid market address' }, { status: 400 })
    }
    if (!selection || typeof selection !== 'string') {
      return NextResponse.json({ error: 'Missing selection' }, { status: 400 })
    }
    if (tokenType !== 'native' && tokenType !== 'erc20') {
      return NextResponse.json({ error: 'Invalid tokenType' }, { status: 400 })
    }
    if (!amount || typeof amount !== 'string') {
      return NextResponse.json({ error: 'Missing amount (wei as string)' }, { status: 400 })
    }

    // Market validation: allow only markets registered by Factory
    if (!(await isAllowedMarket(market))) {
      return NextResponse.json({ error: 'Target not whitelisted' }, { status: 403 })
    }

    const provider = new ethers.JsonRpcProvider(DEPLOYMENT.rpcUrl)

    // Contract ABI aligned with Market.sol
    const abi = [
      'function placeBetNative(address bettor, uint16 selectionId) payable',
      'function placeBetERC20(address bettor, uint16 selectionId, uint256 amount)'
    ]
    const iface = new ethers.Interface(abi)

    // Map selection string to uint16 id (defaults: home=1, away=2)
    let selectionId: number
    const selLower = selection.trim().toLowerCase()
    if (selLower === 'home') selectionId = 1
    else if (selLower === 'away') selectionId = 2
    else {
      const parsed = Number(selection)
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
        return NextResponse.json({ error: 'Invalid selection (expect "home" | "away" or uint16 id)' }, { status: 400 })
      }
      selectionId = parsed
    }

    const tx = {
      to: ethers.getAddress(market),
      data:
        tokenType === 'native'
          ? iface.encodeFunctionData('placeBetNative', [ethers.getAddress(agent), selectionId])
          : iface.encodeFunctionData('placeBetERC20', [ethers.getAddress(agent), selectionId, amount]),
      value: tokenType === 'native' ? amount : undefined,
    } as { to: string; data: string; value?: string }

    // Optional fee data and gas estimate (agent should override as needed)
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

    // Simulate to catch obvious reverts
    try {
      await provider.call({
        from: ethers.getAddress(agent),
        to: tx.to,
        data: tx.data,
        value: tx.value ? ethers.toBigInt(tx.value) : undefined,
      })
    } catch (e: any) {
      return NextResponse.json(
        { error: 'Simulation failed', reason: e?.message || 'call reverted' },
        { status: 400 },
      )
    }

    return NextResponse.json({
      agent: ethers.getAddress(agent),
      network: DEPLOYMENT.network,
      tx,
      feeData,
      gasEstimate,
      syncEndpoint: '/api/x402/transactions/sync',
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}