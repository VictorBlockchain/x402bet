'use client';

import { DynamicContextProvider } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';
import { getEvmNetworks } from '@/lib/config/networks';

const evmNetworks = getEvmNetworks();

interface DynamicProviderProps {
  children: React.ReactNode;
}

export default function DynamicProvider({ children }: DynamicProviderProps) {
  return (
    <DynamicContextProvider
      settings={{
        environmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID || '',
        walletConnectors: [EthereumWalletConnectors],
        overrides: {
          evmNetworks
        },
        cssOverrides: `
          .dynamic-widget-card {
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border: 1px solid #00d4ff;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 212, 255, 0.2);
          }
          
          .dynamic-widget-button {
            background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%);
            border: none;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            transition: all 0.3s ease;
          }
          
          .dynamic-widget-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 16px rgba(0, 212, 255, 0.4);
          }
        `,
      }}
    >
      {children}
    </DynamicContextProvider>
  );
}