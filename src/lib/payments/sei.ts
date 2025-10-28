import { ethers } from 'ethers'
import { getDeployment } from '@/lib/config/deployment'
import { verifyMicropayment } from '../../../x402/facilitator'

/**
 * Result of SEI payment verification
 */
export interface SeiPaymentResult {
  ok: boolean
  reason?: string
  payer?: string
  recipient?: string
  amountWei?: string
  txHash?: string
  network?: string
}

// Sei Oracle precompile address (EVM)
const ORACLE_PRECOMPILE_ADDRESS = '0x0000000000000000000000000000000000001008'

// Minimal ABI for exchange rates and TWAPs based on SeiJS docs
const ORACLE_PRECOMPILE_ABI = [
  {
    type: 'function',
    name: 'getExchangeRates',
    inputs: [],
    outputs: [
      {
        type: 'tuple[]',
        components: [
          { name: 'denom', type: 'string' },
          {
            name: 'oracleExchangeRateVal',
            type: 'tuple',
            components: [
              { name: 'exchangeRate', type: 'string' },
              { name: 'lastUpdateTimestamp', type: 'uint256' },
              { name: 'lastUpdate', type: 'string' },
            ],
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getOracleTwaps',
    inputs: [{ name: 'lookbackSeconds', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple[]',
        components: [
          { name: 'denom', type: 'string' },
          { name: 'twap', type: 'string' },
          { name: 'lookbackSeconds', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
]

async function getSeiUsdPrice(provider: ethers.JsonRpcProvider): Promise<number | undefined> {
  try {
    const oracle = new ethers.Contract(ORACLE_PRECOMPILE_ADDRESS, ORACLE_PRECOMPILE_ABI, provider)
    const rates: any[] = await oracle.getExchangeRates()
    // Common Cosmos denom for SEI is 'usei' (micro SEI); prefer exact match when present
    const target =
      rates.find((r: any) => String(r?.denom || '').toLowerCase() === 'usei') ||
      rates.find((r: any) => String(r?.denom || '').toLowerCase().includes('sei'))
    const raw = target?.oracleExchangeRateVal?.exchangeRate
    const p = raw ? parseFloat(String(raw)) : NaN
    if (Number.isFinite(p) && p > 0) return p
  } catch {}

  // Fallback to TWAP (e.g., 1 hour) if exchange rates not available
  try {
    const oracle = new ethers.Contract(ORACLE_PRECOMPILE_ADDRESS, ORACLE_PRECOMPILE_ABI, provider)
    const twaps: any[] = await oracle.getOracleTwaps(3600n)
    const target =
      twaps.find((r: any) => String(r?.denom || '').toLowerCase() === 'usei') ||
      twaps.find((r: any) => String(r?.denom || '').toLowerCase().includes('sei'))
    const raw = target?.twap
    const p = raw ? parseFloat(String(raw)) : NaN
    if (Number.isFinite(p) && p > 0) return p
  } catch {}

  return undefined
}

/**
 * Converts a USD amount to SEI (in wei) using the on-chain Sei oracle.
 * Falls back to a small fixed fee if the oracle price is unavailable.
 */
async function usdToWei(usdAmount: number, provider: ethers.JsonRpcProvider): Promise<string> {
  const priceUsdPerSei = await getSeiUsdPrice(provider)

  if (priceUsdPerSei && Number.isFinite(priceUsdPerSei) && priceUsdPerSei > 0) {
    // Convert USD to SEI using price (USD per 1 SEI), then to wei
    const seiAmount = usdAmount / priceUsdPerSei
    const seiWei = Math.ceil(seiAmount * 1e18)
    return seiWei.toString()
  }

  // Fallback for resilience: charge a small fixed SEI amount
  console.warn('[sei.usdToWei] Oracle price unavailable, using fallback 0.001 SEI')
  const fallbackSeiAmount = 0.001
  const fallbackWei = Math.ceil(fallbackSeiAmount * 1e18)
  return fallbackWei.toString()
}

/**
 * Main verification function for SEI payments
 * @param txHash - Transaction hash to verify
 * @param payer - Optional payer address to verify
 * @param usdAmount - USD amount to verify (defaults to $0.01)
 * @returns Verification result with ok/reason and payment details
 */
export async function verifySeiPayment(
  txHash: string,
  payer?: string,
  usdAmount: number = 0.01
): Promise<SeiPaymentResult> {
  try {
    const DEPLOYMENT = getDeployment()
    const provider = new ethers.JsonRpcProvider(DEPLOYMENT.rpcUrl)
    const configuredRecipient = (process.env.X402_FEE_RECIPIENT || '').trim()
    const recipient = configuredRecipient && /^0x[a-fA-F0-9]{40}$/.test(configuredRecipient)
      ? ethers.getAddress(configuredRecipient)
      : (DEPLOYMENT.factory ? ethers.getAddress(DEPLOYMENT.factory) : undefined)

    if (!recipient) {
      return { ok: false, reason: 'Fee recipient not configured', network: DEPLOYMENT.network }
    }

    // Get required SEI amount for USD value (hardcoded for local testing)
    const requiredWei = await usdToWei(usdAmount, provider)

    // Delegate to facilitator for verification
    const result = await verifyMicropayment({
      txHash,
      recipient,
      minAmountWei: requiredWei,
      payer
    })

    return {
      ok: result.ok,
      reason: result.reason,
      payer: result.payer,
      recipient: result.recipient,
      amountWei: result.amountWei?.toString(),
      txHash: result.txHash,
      network: result.network
    }
  } catch (error: any) {
    return {
      ok: false,
      reason: `Payment verification failed: ${error.message}`,
      txHash,
      network: getDeployment().network
    }
  }
}