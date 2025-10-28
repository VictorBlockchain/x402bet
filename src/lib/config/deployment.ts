import { getActiveNetworkConfig, getActiveNetworkKey } from '@/lib/config/networks'
import localDeployment from '../../../deployments/local.json'
import mainnetDeployment from '../../../deployments/mainnet.json'

export type DeploymentConfig = {
  network: string
  chainId: number
  rpcUrl: string
  factory: string
  oracle?: string
  x402BetToken?: string
  marketsWhitelist?: string[]
}

function env(name: string): string | undefined {
  try {
    return process.env[name]
  } catch {
    return undefined
  }
}

export function getDeployment(): DeploymentConfig {
  const active = getActiveNetworkConfig().evm
  const activeKey = getActiveNetworkKey()
  const rpcUrl = env('EVM_RPC_URL') || active.rpcUrls[0]
  // Prefer NEXT_PUBLIC_NETWORK for frontend, fallback to legacy X402_NETWORK
  const network = env('NEXT_PUBLIC_NETWORK') || env('X402_NETWORK') || active.vanityName || active.name || 'sei-testnet'
  // Select deployment file by active network key; default to local
  const selected = activeKey === 'mainnet' ? (mainnetDeployment as any) : (localDeployment as any)
  const factory = (selected?.factory as string) || ''
  const oracle = (selected?.oracle as string) || undefined
  const token = (selected?.token as string) || undefined
  const marketsStr = env('X402_MARKETS_WHITELIST') || ''
  const marketsWhitelist = [
    ...((selected as any)?.marketsWhitelist || []),
    ...marketsStr
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  ]

  return {
    network,
    chainId: active.chainId,
    rpcUrl,
    factory,
    oracle,
    x402BetToken: token,
    marketsWhitelist,
  }
}

export function getChainId(): number {
  return getDeployment().chainId
}

export function getRpcUrl(): string {
  return getDeployment().rpcUrl
}

export function getFactoryAddress(): string {
  return getDeployment().factory
}

export function getBetTokenAddress(): string | undefined {
  return getDeployment().x402BetToken
}

export function getOracleAddress(): string | undefined {
  return getDeployment().oracle
}