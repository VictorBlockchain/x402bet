import { ethers } from 'ethers'
import { getDeployment } from '@/lib/config/deployment'

// Minimal ABIs for factory and market
const FACTORY_ABI = [
  'function marketByEventId(uint64 eventId) view returns (address)',
  'function x402BetToken() view returns (address)'
]

const MARKET_ABI = [
  'function placeBetNative(address bettor, uint16 selectionId) payable',
  'function placeBetERC20(address bettor, uint16 selectionId, uint256 amount)',
  'function token() view returns (address)'
]

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)'
]

export type TokenChoice = 'SEI' | 'x402Bet'
export type Selection = 'home' | 'away'

function selectionToId(selection: Selection): number {
  const s = String(selection).toLowerCase()
  if (s === 'home') return 1
  if (s === 'away') return 2
  throw new Error('Unsupported selection')
}

export async function placeBet(params: {
  eventId: string | number
  selection: Selection
  amount: string // human string e.g. "10"
  token: TokenChoice
}): Promise<{ txHash: string; market: string }> {
  if (typeof window === 'undefined' || !(window as any).ethereum) {
    throw new Error('Wallet provider not available')
  }

  const DEPLOY = getDeployment()
  if (!DEPLOY.factory) throw new Error('Factory address not configured (X402_FACTORY_ADDRESS)')

  const provider = new ethers.BrowserProvider((window as any).ethereum)
  const signer = await provider.getSigner()

  const factory = new ethers.Contract(DEPLOY.factory, FACTORY_ABI, signer)
  const eventIdNum = typeof params.eventId === 'string' ? Number(params.eventId) : params.eventId
  if (!Number.isFinite(eventIdNum) || eventIdNum < 0) throw new Error('Invalid eventId')
  let marketAddr: string = await factory.marketByEventId(eventIdNum)

  if (!marketAddr || marketAddr === ethers.ZeroAddress) {
    throw new Error('Market not found for eventId. Use API /api/x402/market/ensure to create it with full metadata.')
  }

  const market = new ethers.Contract(marketAddr, MARKET_ABI, signer)
  let decimals = 18

  const amountFloat = parseFloat(params.amount || '0')
  if (!Number.isFinite(amountFloat) || amountFloat <= 0) throw new Error('Invalid amount')
  const amountWei = ethers.parseUnits(amountFloat.toString(), decimals)

  const bettor = await signer.getAddress()

  if (params.token === 'SEI') {
    const tx = await market.placeBetNative(bettor, selectionToId(params.selection), { value: amountWei })
    const rec = await tx.wait()
    return { txHash: rec?.hash || tx?.hash, market: marketAddr }
  } else {
    // Approve ERC20 if needed
    if (!DEPLOY.x402BetToken) throw new Error('x402Bet token address not configured (X402_BET_TOKEN)')
    const erc = new ethers.Contract(DEPLOY.x402BetToken, ERC20_ABI, signer)
    try {
      decimals = await erc.decimals()
    } catch {}
    const amt = ethers.parseUnits(amountFloat.toString(), decimals)
    const owner = await signer.getAddress()
    const current = await erc.allowance(owner, marketAddr)
    if (current < amt) {
      const txApprove = await erc.approve(marketAddr, amt)
      await txApprove.wait()
    }
    const tx = await market.placeBetERC20(bettor, selectionToId(params.selection), amt)
    const rec = await tx.wait()
    return { txHash: rec?.hash || tx?.hash, market: marketAddr }
  }
}