// End-to-end test of x402 routes with a production-ready agent
import fs from 'node:fs'
import path from 'node:path'
import { ethers } from 'ethers'

const NEXT_BASE = 'http://localhost:3000'
const deploymentsPath = path.join(process.cwd(), 'deployments', 'local.json')
const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'))

// Use Hardhat node default account #2 as agent for local testing
const agentPk = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'
const provider = new ethers.JsonRpcProvider(deployments.rpcUrl)
const agent = new ethers.Wallet(agentPk, provider)

const FACTORY_ABI = [
  'function marketByEventId(uint64 eventId) view returns (address)',
]

const MARKET_ABI = [
  'function settled() view returns (bool)',
  'function winningSelection() view returns (uint16)',
  'function homeSelectionId() view returns (uint16)',
  'function awaySelectionId() view returns (uint16)',
  'function isPush() view returns (bool)',
  'function cancelled() view returns (bool)',
  'function payoutMultiplier() view returns (uint256)',
  'function stakes(address bettor, uint16 selectionId) view returns (uint256)',
  'function claimed(address bettor) view returns (bool)',
  'function claim() external'
]

async function main() {
  console.log('Network:', deployments.rpcUrl)
  console.log('Factory:', deployments.factory)
  console.log('Agent:', await agent.getAddress())

  const eventId = Math.floor(Date.now() / 1000)
  const ensurePayload = {
    agent: await agent.getAddress(),
    eventId,
    homeSelectionId: 1,
    awaySelectionId: 2,
    spreadTenths: 0,
    spreadAppliesToHome: true,
    sport: 'basketball_nba',
    region: 'us',
    proposition: 'moneyline',
    homeVsAway: 'home:away',
    initialSelection: 'home',
    tokenType: 'native',
    amount: ethers.parseEther('0.001').toString(),
  }

  // Step 1: Ensure market exists (build tx to Factory if missing)
  const ensureResp = await fetch(`${NEXT_BASE}/api/x402/market/ensure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ensurePayload),
  })
  const ensureJson = await ensureResp.json()
  if (!ensureResp.ok) {
    console.error('ensure response detail:', ensureJson)
    throw new Error(`ensure failed: ${ensureJson.error || ensureResp.statusText}`)
  }

  let marketAddress = ensureJson.market
  let txToSend = ensureJson.tx
  console.log('ensure result:', ensureJson)

  if (!marketAddress) {
    // Verify the tx to Factory
    const verifyPayload = {
      agent: await agent.getAddress(),
      tx: txToSend,
      paymentRequirements: { network: ensureJson.network || 'local' },
    }
    const verifyResp = await fetch(`${NEXT_BASE}/api/x402/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(verifyPayload),
    })
    const verifyJson = await verifyResp.json()
    if (!verifyResp.ok || !verifyJson.isValid) {
      throw new Error(`verify failed: ${verifyJson.error || 'invalid tx'}`)
    }

    console.log('verify ok, sending createMarket...')
    const resp = await agent.sendTransaction({
      to: txToSend.to,
      data: txToSend.data,
      value: txToSend.value ? ethers.toBigInt(txToSend.value) : undefined,
      maxFeePerGas: txToSend.maxFeePerGas ? ethers.toBigInt(txToSend.maxFeePerGas) : undefined,
      maxPriorityFeePerGas: txToSend.maxPriorityFeePerGas ? ethers.toBigInt(txToSend.maxPriorityFeePerGas) : undefined,
    })
    const receipt = await resp.wait()
    console.log('createMarket tx hash:', resp.hash, 'status:', receipt?.status)

    // Query market address
    const factory = new ethers.Contract(deployments.factory, FACTORY_ABI, provider)
    marketAddress = await factory.marketByEventId(eventId)
    console.log('created market:', marketAddress)

    // Sync on-chain events into Supabase
    try {
      const syncResp = await fetch(`${NEXT_BASE}/api/x402/transactions/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash: resp.hash }),
      })
      const syncJson = await syncResp.json()
      if (!syncResp.ok) console.warn('sync failed:', syncJson)
      else console.log('sync result:', syncJson)
    } catch (err) {
      console.warn('sync error:', err?.message || err)
    }

    // Persist whitelist into deployments/local.json for API accept prepare route
    const current = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'))
    const list = new Set([...(current.marketsWhitelist || []), ethers.getAddress(marketAddress)])
    current.marketsWhitelist = Array.from(list)
    fs.writeFileSync(deploymentsPath, JSON.stringify(current, null, 2) + '\n', 'utf8')
    console.log('updated deployments/local.json whitelist with market')
  }

  // Step 2: Prepare bet tx
  const preparePayload = {
    agent: await agent.getAddress(),
    market: ethers.getAddress(marketAddress),
    selection: 'home',
    tokenType: 'native',
    amount: ethers.parseEther('0.001').toString(),
  }
  const prepareResp = await fetch(`${NEXT_BASE}/api/x402/market/prepare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preparePayload),
  })
  const prepareJson = await prepareResp.json()
  if (!prepareResp.ok) {
    throw new Error(`prepare failed: ${prepareJson.error || prepareResp.statusText}`)
  }
  console.log('prepare result:', prepareJson)

  // Step 3: Verify bet tx
  const verifyBetPayload = {
    agent: await agent.getAddress(),
    tx: prepareJson.tx,
    paymentRequirements: { network: prepareJson.network || 'local' },
    slippageBps: 50,
  }
  const verifyBetResp = await fetch(`${NEXT_BASE}/api/x402/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(verifyBetPayload),
  })
  const verifyBetJson = await verifyBetResp.json()
  if (!verifyBetResp.ok || !verifyBetJson.isValid) {
    throw new Error(`bet verify failed: ${verifyBetJson.error || 'invalid bet tx'}`)
  }
  console.log('bet verify ok, sending...')

  const betResp = await agent.sendTransaction({
    to: verifyBetPayload.tx.to,
    data: verifyBetPayload.tx.data,
    value: verifyBetPayload.tx.value ? ethers.toBigInt(verifyBetPayload.tx.value) : undefined,
    maxFeePerGas: verifyBetPayload.tx.maxFeePerGas ? ethers.toBigInt(verifyBetPayload.tx.maxFeePerGas) : undefined,
    maxPriorityFeePerGas: verifyBetPayload.tx.maxPriorityFeePerGas ? ethers.toBigInt(verifyBetPayload.tx.maxPriorityFeePerGas) : undefined,
  })
  const betReceipt = await betResp.wait()
  console.log('bet tx hash:', betResp.hash, 'status:', betReceipt?.status)

  // Step 4: Check market status before settlement
  const market = new ethers.Contract(marketAddress, MARKET_ABI, provider)
  const isSettledBefore = await market.settled()
  console.log('market settled before oracle:', isSettledBefore)

  // Step 5: Settle market via Oracle API
  console.log('settling market via oracle...')
  const settlePayload = {
    marketAddress: ethers.getAddress(marketAddress),
    scores: [100, 95], // Home team wins with score 100-95
    eventId
  }
  const settleResp = await fetch(`${NEXT_BASE}/api/x402/oracle/settle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settlePayload),
  })
  const settleJson = await settleResp.json()
  if (!settleResp.ok) {
    throw new Error(`settlement failed: ${settleJson.error || settleResp.statusText}`)
  }
  console.log('settlement result:', settleJson)

  // Step 6: Verify market is now settled
  const isSettledAfter = await market.settled()
  const winningSelection = await market.winningSelection()
  const homeSelectionId = await market.homeSelectionId()
  const awaySelectionId = await market.awaySelectionId()
  
  console.log('market settled after oracle:', isSettledAfter)
  console.log('winning selection:', winningSelection.toString())
  console.log('home selection id:', homeSelectionId.toString())
  console.log('away selection id:', awaySelectionId.toString())

  // Step 7: Check payout preview (manual, based on contract state)
  const isPushFlag = await market.isPush()
  const isCancelledFlag = await market.cancelled()
  const alreadyClaimed = await market.claimed(await agent.getAddress())
  const pm = await market.payoutMultiplier()
  const stakeHome = await market.stakes(await agent.getAddress(), homeSelectionId)
  const stakeAway = await market.stakes(await agent.getAddress(), awaySelectionId)
  const stakeWin = await market.stakes(await agent.getAddress(), winningSelection)
  
  let payoutPreview = 0n
  let canClaim = false
  if (isPushFlag || isCancelledFlag) {
    payoutPreview = (stakeHome + stakeAway)
    canClaim = payoutPreview > 0n && !alreadyClaimed
  } else {
    payoutPreview = stakeWin > 0n ? (stakeWin * pm) / 1000000000000000000n : 0n
    canClaim = stakeWin > 0n && !alreadyClaimed
  }
  console.log('payout preview - amount:', ethers.formatEther(payoutPreview), 'ETH, can claim:', canClaim)

  // Step 8: Claim payout if available
  if (canClaim && payoutPreview > 0n) {
    console.log('claiming payout...')
    const claimTx = await market.connect(agent).claim()
    const claimReceipt = await claimTx.wait()
    console.log('claim tx hash:', claimTx.hash, 'status:', claimReceipt?.status)
    
    // Check balance after claim
    const balanceAfter = await provider.getBalance(await agent.getAddress())
    console.log('agent balance after claim:', ethers.formatEther(balanceAfter), 'ETH')
  } else {
    console.log('no payout available or cannot claim')
  }

  console.log('✅ End-to-end test completed successfully!')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})