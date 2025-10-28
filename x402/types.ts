// Minimal stubs to satisfy @x402-sovereign/core imports during build

export const SupportedEVMNetworks = ['sei', 'sei-testnet', 'base', 'base-sepolia']

export function createConnectedClient(network: string) {
  return { network }
}

export async function createSigner(network: string, privateKey: string) {
  // Development placeholder
  return { network, privateKey }
}
