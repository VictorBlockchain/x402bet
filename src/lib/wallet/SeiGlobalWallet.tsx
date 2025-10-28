'use client';

import { useEffect } from 'react';
import { getActiveNetworkConfig } from '@/lib/config/networks';

// Import Sei Global Wallet to register EIP-6963 provider
import '@sei-js/sei-global-wallet/eip6963';

// Extend window interface for TypeScript
declare global {
  interface Window {
    eip6963Providers?: any;
  }
}

interface EIP6963AnnounceProviderEvent extends CustomEvent {
  detail: {
    info: {
      name: string;
      icon: string;
      uuid: string;
      rdns: string;
    };
    provider: any;
  };
}

export function SeiGlobalWalletProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Debug EIP-6963 providers
    if (typeof window !== 'undefined') {
      console.log('EIP-6963 providers:', window.eip6963Providers);
      
      // Listen for wallet announcements
      window.addEventListener('eip6963:announceProvider', (event) => {
        const providerEvent = event as EIP6963AnnounceProviderEvent;
        console.log('Wallet announced:', providerEvent.detail);
      });
      
      // Request wallet announcements
      window.dispatchEvent(new Event('eip6963:requestProvider'));
    }
  }, []);

  return <>{children}</>; 
}

// Utility function to check if Sei Global Wallet is available
export function isSeiGlobalWalletAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  
  return window.eip6963Providers?.some((provider: any) => 
    provider.info.name?.toLowerCase().includes('sei')
  ) || false;
}

// Utility function to get Sei network configuration
export const seiNetworkConfig = (() => {
  const active = getActiveNetworkConfig().evm;
  const toHex = (id: number) => '0x' + id.toString(16).toUpperCase();
  return {
    active: {
      chainId: toHex(active.chainId),
      chainName: active.chainName,
      nativeCurrency: active.nativeCurrency,
      rpcUrls: active.rpcUrls,
      blockExplorerUrls: active.blockExplorerUrls || [],
    },
  } as const;
})();