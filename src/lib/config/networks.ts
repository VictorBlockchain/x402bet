export type NetworkKey = 'local' | 'testnet' | 'mainnet';

export interface EvmNetwork {
  blockExplorerUrls: string[];
  chainId: number;
  chainName: string;
  iconUrls: string[]; // Dynamic expects string[] (not optional)
  name: string;
  nativeCurrency: {
    decimals: number;
    name: string;
    symbol: string;
  };
  networkId: number;
  rpcUrls: string[];
  vanityName?: string;
}

interface NetworkConfig {
  key: NetworkKey;
  label: string;
  evm: EvmNetwork;
}

const NETWORKS: Record<NetworkKey, NetworkConfig> = {
  local: {
    key: 'local',
    label: 'Local Hardhat',
    evm: {
      chainId: 31337,
      chainName: 'Hardhat Local',
      iconUrls: [],
      name: 'Hardhat',
      nativeCurrency: {
        decimals: 18,
        name: 'ETH',
        symbol: 'ETH',
      },
      networkId: 31337,
      rpcUrls: ['http://localhost:8545'],
      blockExplorerUrls: [],
      vanityName: 'Local',
    },
  },
  testnet: {
    key: 'testnet',
    label: 'Sei Testnet',
    evm: {
      blockExplorerUrls: ['https://seitrace.com/?chain=atlantic-2'],
      chainId: 713715,
      chainName: 'Sei Testnet',
      iconUrls: ['https://sei.io/favicon.ico'],
      name: 'Sei Atlantic 2',
      nativeCurrency: {
        decimals: 18,
        name: 'SEI',
        symbol: 'SEI',
      },
      networkId: 713715,
      rpcUrls: ['https://evm-rpc-testnet.sei-apis.com'],
      vanityName: 'Sei Testnet',
    },
  },
  mainnet: {
    key: 'mainnet',
    label: 'Sei Mainnet',
    evm: {
      blockExplorerUrls: ['https://seitrace.com'],
      chainId: 1329,
      chainName: 'Sei Network',
      iconUrls: ['https://sei.io/favicon.ico'],
      name: 'Sei Mainnet',
      nativeCurrency: {
        decimals: 18,
        name: 'SEI',
        symbol: 'SEI',
      },
      networkId: 1329,
      rpcUrls: ['https://evm-rpc.sei-apis.com'],
      vanityName: 'Sei',
    },
  },
};

export function getActiveNetworkKey(): NetworkKey {
  const raw = (process.env.NEXT_PUBLIC_NETWORK || '').toLowerCase();
  if (raw === 'local' || raw === 'testnet' || raw === 'mainnet') return raw as NetworkKey;
  return 'testnet';
}

export function getActiveNetworkConfig(): NetworkConfig {
  const key = getActiveNetworkKey();
  return NETWORKS[key];
}

export function getEvmNetworks(): EvmNetwork[] {
  // Expose all networks to wallet UI; prioritize active one first
  const active = getActiveNetworkConfig().evm;
  const others = Object.values(NETWORKS)
    .map((n) => n.evm)
    .filter((n) => n.chainId !== active.chainId);
  return [active, ...others];
}

export function getActiveNetworkLabel(): string {
  return getActiveNetworkConfig().label;
}