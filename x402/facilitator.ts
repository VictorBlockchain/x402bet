// Production-grade x402 facilitator: payload validation, address whitelisting,
// transaction simulation, and optional settlement broadcasting.

import { ethers } from 'ethers'
import { getDeployment, getRpcUrl } from '../src/lib/config/deployment'

export type VerificationResult = {
  isValid: boolean
  payer?: string
}

export type SettlementResult = {
  success: boolean
  errorReason?: string
  transaction: string
  network: string
  payer?: string
}

// Provider and network config
const DEPLOYMENT = getDeployment()
const RPC_URL = getRpcUrl()
const provider = new ethers.JsonRpcProvider(RPC_URL)

// Whitelisted contract addresses (from centralized deployment config)
const addressRegex = /^0x[a-fA-F0-9]{40}$/
const WHITELIST = new Set(
  Object.values(DEPLOYMENT).filter(
    (v) => typeof v === 'string' && addressRegex.test(v as string),
  ) as string[],
)

function isWhitelistedAddress(addr?: string): boolean {
  if (!addr || !addressRegex.test(addr)) return false
  return WHITELIST.has(ethers.getAddress(addr))
}

function isValidAgent(address?: string): boolean {
  try {
    if (!address) return false
    ethers.getAddress(address)
    return true
  } catch {
    return false
  }
}

async function simulateTx(tx: {
  from: string
  to: string
  data?: string
  value?: string | bigint
}): Promise<{ ok: boolean; errorReason?: string }> {
  try {
    // Normalize types for call
    const callReq: ethers.TransactionRequest = {
      from: tx.from,
      to: tx.to,
      data: tx.data || '0x',
      value:
        typeof tx.value === 'string'
          ? (tx.value as string)
          : typeof tx.value === 'bigint'
            ? tx.value
            : undefined,
    }
    await provider.call(callReq)
    return { ok: true }
  } catch (err: any) {
    const msg = err?.reason || err?.message || 'Simulation failed'
    return { ok: false, errorReason: msg }
  }
}

// Basic payload guard. We expect a structure like { agent, tx: { to, data, value, gas, ... }, kind }
function validatePayloadShape(payload: any): { ok: boolean; reason?: string } {
  if (!payload || typeof payload !== 'object') return { ok: false, reason: 'Missing payload' }
  if (!isValidAgent(payload.agent)) return { ok: false, reason: 'Invalid agent address' }
  const tx = payload.tx
  if (!tx || typeof tx !== 'object') return { ok: false, reason: 'Missing tx' }
  if (!isWhitelistedAddress(tx.to)) return { ok: false, reason: 'Non-whitelisted to address' }
  if (typeof tx.data !== 'string') return { ok: false, reason: 'Missing calldata' }
  // Optional controls
  if (payload.slippageBps !== undefined) {
    const s = Number(payload.slippageBps)
    if (!Number.isFinite(s) || s < 0 || s > 500) {
      return { ok: false, reason: 'slippageBps out of bounds (0-500)' }
    }
  }
  return { ok: true }
}

export async function verify(
  client: any,
  paymentPayload: any,
  paymentRequirements: { network: string },
): Promise<VerificationResult> {
  // Check environment alignment
  const requiredNetwork = paymentRequirements?.network
  const currentNetwork = DEPLOYMENT.network
  const networkOk = !!requiredNetwork && requiredNetwork === currentNetwork

  // Base payload validation
  const base = validatePayloadShape(paymentPayload)
  if (!networkOk || !base.ok) {
    return { isValid: false, payer: paymentPayload?.agent || undefined }
  }

  // Optional simulation to catch obvious reverts before settlement
  const sim = await simulateTx({
    from: paymentPayload.agent,
    to: paymentPayload.tx.to,
    data: paymentPayload.tx.data,
    value: paymentPayload.tx.value,
  })

  return {
    isValid: sim.ok,
    payer: paymentPayload?.agent || undefined,
  }
}

export async function settle(
  signer: any,
  paymentPayload: any,
  paymentRequirements: { network: string },
): Promise<SettlementResult> {
  try {
    if (!signer) {
      return {
        success: false,
        errorReason: 'Missing signer',
        transaction: '',
        network: DEPLOYMENT.network,
        payer: paymentPayload?.agent || undefined,
      }
    }

    const networkOk = paymentRequirements?.network === DEPLOYMENT.network
    if (!networkOk) {
      return {
        success: false,
        errorReason: 'Network mismatch',
        transaction: '',
        network: DEPLOYMENT.network,
        payer: paymentPayload?.agent || undefined,
      }
    }

    // Validate payload before sending
    const base = validatePayloadShape(paymentPayload)
    if (!base.ok) {
      return {
        success: false,
        errorReason: base.reason || 'Invalid payload',
        transaction: '',
        network: DEPLOYMENT.network,
        payer: paymentPayload?.agent || undefined,
      }
    }

    // Ensure signer is the provided agent (safety control)
    const signerAddr = await signer.getAddress?.()
    if (!signerAddr || ethers.getAddress(signerAddr) !== ethers.getAddress(paymentPayload.agent)) {
      return {
        success: false,
        errorReason: 'Signer does not match agent',
        transaction: '',
        network: DEPLOYMENT.network,
        payer: paymentPayload?.agent || undefined,
      }
    }

    // Simulate once more for safety
    const sim = await simulateTx({
      from: paymentPayload.agent,
      to: paymentPayload.tx.to,
      data: paymentPayload.tx.data,
      value: paymentPayload.tx.value,
    })
    if (!sim.ok) {
      return {
        success: false,
        errorReason: sim.errorReason || 'Simulation failed',
        transaction: '',
        network: DEPLOYMENT.network,
        payer: paymentPayload?.agent || undefined,
      }
    }

    // Broadcast
    const txReq: ethers.TransactionRequest = {
      to: paymentPayload.tx.to,
      data: paymentPayload.tx.data,
      value: paymentPayload.tx.value,
      gasLimit: paymentPayload.tx.gas,
      maxFeePerGas: paymentPayload.tx.maxFeePerGas,
      maxPriorityFeePerGas: paymentPayload.tx.maxPriorityFeePerGas,
    }

    const response = await signer.sendTransaction(txReq)
    const receipt = await response.wait()

    return {
      success: receipt?.status === 1,
      errorReason: receipt?.status === 1 ? undefined : 'Transaction failed',
      transaction: response?.hash || '',
      network: DEPLOYMENT.network,
      payer: paymentPayload?.agent || undefined,
    }
  } catch (err: any) {
    const msg = err?.reason || err?.message || 'Broadcast error'
    return {
      success: false,
      errorReason: msg,
      transaction: '',
      network: DEPLOYMENT.network,
      payer: paymentPayload?.agent || undefined,
    }
  }
}

// Micropayment verification for paid API endpoints (native SEI transfers)
export type MicropaymentVerificationResult = {
  ok: boolean
  reason?: string
  payer?: string
  recipient?: string
  amountWei?: bigint
  txHash: string
  network: string
}

export async function verifyMicropayment(params: {
  txHash: string
  recipient: string
  minAmountWei?: bigint | string
  payer?: string
}): Promise<MicropaymentVerificationResult> {
  const DEFAULT_MIN_AMOUNT_WEI = 10000000000000000n // 0.01 SEI (1e16 wei-equivalent)

  try {
    const txHash = params.txHash
    if (!txHash || typeof txHash !== 'string') {
      return { ok: false, reason: 'Missing txHash', txHash: txHash || '', network: DEPLOYMENT.network }
    }

    // Normalize addresses
    let recipient: string
    try {
      recipient = ethers.getAddress(params.recipient)
    } catch {
      return { ok: false, reason: 'Invalid recipient', txHash, network: DEPLOYMENT.network }
    }

    const expectedPayer = params.payer ? (() => { try { return ethers.getAddress(params.payer) } catch { return undefined } })() : undefined

    // Fetch tx and receipt
    const tx = await provider.getTransaction(txHash)
    const receipt = await provider.getTransactionReceipt(txHash)

    if (!tx || !receipt) {
      return { ok: false, reason: 'Transaction not found', txHash, network: DEPLOYMENT.network }
    }

    if (receipt.status !== 1) {
      return { ok: false, reason: 'Transaction failed', txHash, network: DEPLOYMENT.network }
    }

    // Direct native transfer checks
    if (!tx.to) {
      return { ok: false, reason: 'Missing to address', txHash, network: DEPLOYMENT.network }
    }

    const txTo = ethers.getAddress(tx.to)
    if (txTo !== recipient) {
      return { ok: false, reason: 'Recipient mismatch', txHash, network: DEPLOYMENT.network }
    }

    if (!tx.value || tx.value <= 0n) {
      return { ok: false, reason: 'No native amount', txHash, network: DEPLOYMENT.network }
    }

    const minRequired = typeof params.minAmountWei === 'string'
      ? BigInt(params.minAmountWei)
      : (params.minAmountWei ?? DEFAULT_MIN_AMOUNT_WEI)

    if (tx.value < minRequired) {
      return { ok: false, reason: 'Insufficient amount', txHash, network: DEPLOYMENT.network, amountWei: tx.value, recipient }
    }

    // Optional payer check
    const actualFrom = tx.from ? ethers.getAddress(tx.from) : undefined
    if (expectedPayer && (!actualFrom || actualFrom !== expectedPayer)) {
      return { ok: false, reason: 'Payer mismatch', txHash, network: DEPLOYMENT.network }
    }

    return {
      ok: true,
      txHash,
      network: DEPLOYMENT.network,
      payer: actualFrom,
      recipient,
      amountWei: tx.value,
    }
  } catch (err: any) {
    const msg = err?.reason || err?.message || 'Micropayment verify error'
    return { ok: false, reason: msg, txHash: params.txHash, network: DEPLOYMENT.network }
  }
}
