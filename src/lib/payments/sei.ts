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
 * Converts USD amount to SEI wei - hardcoded for local testing
 * For local/hardhat testing, we use a fixed rate of 0.001 SEI per API call
 */
async function usdToWei(usdAmount: number, provider: ethers.JsonRpcProvider): Promise<string> {
  // For local testing: hardcode 0.001 SEI regardless of USD amount
  const hardcodedSeiAmount = 0.001
  const seiWei = Math.ceil(hardcodedSeiAmount * 1e18)
  return seiWei.toString()

  // TODO: Uncomment below for production with oracle pricing
  /*
  try {
    // Query Sei Oracle precompile for exchange rates
    const oracleContract = new ethers.Contract(
      ORACLE_PRECOMPILE_ADDRESS,
      ORACLE_PRECOMPILE_ABI,
      provider
    )

    let seiPriceUsd: number | null = null

    try {
      // Try to get current exchange rates first
      const exchangeRates = await oracleContract.getExchangeRates()
      const seiRate = exchangeRates.find((rate: any) => rate.denom === 'usei')
      if (seiRate) {
        seiPriceUsd = parseFloat(seiRate.oracleExchangeRateVal.exchangeRate)
      }
    } catch (e) {
      console.warn('Failed to get current exchange rates:', e)
    }

    if (!seiPriceUsd) {
      try {
        // Fallback to 1-hour TWAP
        const lookbackSeconds = BigInt(3600) // 1 hour
        const twapData = await oracleContract.getOracleTwaps(lookbackSeconds)
        const seiTwap = twapData.find((twap: any) => twap.denom === 'usei')
        if (seiTwap) {
          seiPriceUsd = parseFloat(seiTwap.twap)
        }
      } catch (e) {
        console.warn('Failed to get TWAP data:', e)
      }
    }

    if (!seiPriceUsd || seiPriceUsd <= 0) {
      throw new Error('Unable to fetch SEI price from oracle')
    }

    // Convert USD to SEI, then to wei (18 decimals)
    const seiAmount = usdAmount / seiPriceUsd
    const seiWei = Math.ceil(seiAmount * 1e18)
    return seiWei.toString()
  } catch (e) {
    console.warn('Oracle price fetch failed, using fallback:', e)
    // Fallback: assume 0.01 SEI = $0.01 (1:1 ratio for testing)
    const fallbackSeiWei = Math.ceil((usdAmount / 0.01) * 0.01 * 1e18)
    return fallbackSeiWei.toString()
  }
  */
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