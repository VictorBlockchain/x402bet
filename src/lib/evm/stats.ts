import { ethers } from 'ethers'
import { getDeployment } from '@/lib/config/deployment'

const FACTORY_ABI = [
  'function marketByEventId(uint64 eventId) view returns (address)',
  'function getMarkets() view returns (address[])'
]

const MARKET_ABI = [
  'event BetPlaced(address indexed bettor, uint16 indexed selectionId, uint256 stake, uint256 fee)',
  'function settled() view returns (bool)',
  'function winningSelection() view returns (uint16)',
  'function homeSelectionId() view returns (uint16)',
  'function awaySelectionId() view returns (uint16)'
]

export type BettorEntry = {
  bettor: string
  selectionHash: string
  selectionLabel?: 'home' | 'away' | 'unknown'
  stakeWei: bigint
  feeWei: bigint
  txHash: string
  blockNumber: bigint
}

function getRpcProvider(): ethers.JsonRpcProvider {
  const { rpcUrl } = getDeployment()
  return new ethers.JsonRpcProvider(rpcUrl)
}

export async function getMarketAddress(eventId: string | number): Promise<string> {
  const { factory } = getDeployment()
  if (!factory) throw new Error('Factory address not configured (X402_FACTORY_ADDRESS)')
  const provider = getRpcProvider()
  const factoryContract = new ethers.Contract(factory, FACTORY_ABI, provider)
  const idNum = typeof eventId === 'string' ? Number(eventId) : eventId
  if (!Number.isFinite(idNum) || idNum < 0) throw new Error('Invalid eventId')
  const addr: string = await factoryContract.marketByEventId(idNum)
  return addr
}

export async function getEventBettors(eventId: string | number): Promise<{ market: string; settled: boolean; winningSelection?: string; bettors: BettorEntry[] }>
{
  const provider = getRpcProvider()
  const marketAddr = await getMarketAddress(eventId)
  if (!marketAddr || marketAddr === ethers.ZeroAddress) {
    return { market: ethers.ZeroAddress, settled: false, bettors: [] }
  }
  const market = new ethers.Contract(marketAddr, MARKET_ABI, provider)
  const iface = new ethers.Interface(MARKET_ABI)
  const eventFrag = iface.getEvent('BetPlaced')
  const eventTopic = eventFrag?.topicHash ?? ethers.id('BetPlaced(address,uint16,uint256,uint256)')

  // Query all BetPlaced logs for this market
  const latest = await provider.getBlockNumber()
  const logs = await provider.getLogs({ address: marketAddr, topics: [eventTopic], fromBlock: ethers.toBigInt(0), toBlock: ethers.toBigInt(latest) })
  const bettors: BettorEntry[] = []
  for (const log of logs) {
    try {
      const parsed = (() => { try { return iface.parseLog(log) } catch { return null } })()
      if (!parsed) continue
      const args = parsed.args as readonly unknown[]
      const bettor = (args[0] as string)?.toLowerCase?.() ?? ''
      if (!bettor) continue
      const selId = args[1] as number
      const stakeWei = args[2] as bigint
      const feeWei = args[3] as bigint
      const txHash = log.transactionHash as string
      const blockNumber = ethers.toBigInt((log.blockNumber as number | bigint | null | undefined) ?? 0)

      // Determine labels by reading selection ids
      let selectionLabel: 'home' | 'away' | 'unknown' = 'unknown'
      try {
        const homeId: number = await market.homeSelectionId()
        const awayId: number = await market.awaySelectionId()
        if (selId === homeId) selectionLabel = 'home'
        else if (selId === awayId) selectionLabel = 'away'
      } catch {}

      bettors.push({ bettor, selectionHash: String(selId), selectionLabel, stakeWei, feeWei, txHash, blockNumber })
    } catch {}
  }

  let settled = false
  let winningSelection: string | undefined
  try {
    settled = await market.settled()
    const winId: number = await market.winningSelection()
    winningSelection = String(winId)
  } catch {}

  return { market: marketAddr, settled, winningSelection, bettors }
}

export async function getProfileStats(address: string): Promise<{
  address: string
  wins: number
  losses: number
  pending: number
  totalStakedWei: bigint
  marketsTouched: number
}>
{
  const { factory } = getDeployment()
  if (!factory) throw new Error('Factory address not configured (X402_FACTORY_ADDRESS)')
  const provider = getRpcProvider()
  const factoryContract = new ethers.Contract(factory, FACTORY_ABI, provider)
  let markets: string[] = []
  try {
    markets = await factoryContract.getMarkets()
  } catch {
    markets = []
  }

  const iface = new ethers.Interface(MARKET_ABI)
  const eventFrag = iface.getEvent('BetPlaced')
  const eventTopic = eventFrag?.topicHash ?? ethers.id('BetPlaced(address,uint16,uint256,uint256)')
  const addrTopic = ethers.zeroPadValue(address, 32).toLowerCase()
  const latest = await provider.getBlockNumber()

  let wins = 0, losses = 0, pending = 0
  // Use constructor form to avoid BigInt literal requirement on lower TS targets
  let totalStakedWei: bigint = BigInt(0);
  let marketsTouched = 0

  for (const m of markets) {
    try {
      const logs = await provider.getLogs({ address: m, topics: [eventTopic, addrTopic], fromBlock: ethers.toBigInt(0), toBlock: ethers.toBigInt(latest) })
      if (logs.length === 0) continue
      marketsTouched += 1
      // Read market state
      const market = new ethers.Contract(m, MARKET_ABI, provider)
      let settled = false
      let winningSelection: string | undefined
      try {
        settled = await market.settled()
        const winId: number = await market.winningSelection()
        winningSelection = String(winId)
      } catch {}
      for (const log of logs) {
        try {
          const parsed = (() => { try { return iface.parseLog(log) } catch { return null } })()
          if (!parsed) continue
          const args = parsed.args as readonly unknown[]
          const selHash = args[1] as string
          const stakeWei = args[2] as bigint
          totalStakedWei += stakeWei
          if (!settled) pending += 1
          else if (winningSelection && selHash.toLowerCase() === (winningSelection as string).toLowerCase()) wins += 1
          else losses += 1
        } catch {}
      }
    } catch {}
  }

  return { address: address.toLowerCase(), wins, losses, pending, totalStakedWei, marketsTouched }
}