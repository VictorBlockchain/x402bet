'use client';

import Link from 'next/link';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';

export default function Header() {
  const { setShowAuthFlow, user, primaryWallet } = useDynamicContext();
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b-2 border-border shadow-md">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Branding + Live Indicator */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-chart-1 rounded-full animate-ping" />
            <div className="relative w-3 h-3 bg-chart-1 rounded-full animate-pulse" />
          </div>
          <Link
            href="/"
            className="bg-gradient-to-r from-primary/20 to-primary/10 border-2 border-primary/30 text-primary px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:scale-110 transition-transform"
            style={{ fontFamily: 'var(--font-orbitron)' }}
          >
            x402bet.fun
          </Link>
        </div>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-2 text-xs font-black uppercase">
          <Link href="/docs" className="px-3 py-2 rounded-xl border-2 border-primary/30 text-muted-foreground hover:text-foreground hover:border-primary/50 hover:scale-105 transition-all duration-300">Docs</Link>
          {primaryWallet?.address ? (
            <button
              type="button"
              aria-label="Manage Wallet"
              title={primaryWallet.address}
              onClick={() => setShowAuthFlow(true)}
              className="ml-2 inline-flex h-9 items-center justify-center rounded-xl border-2 border-primary/30 bg-card text-foreground hover:bg-accent transition-all duration-300 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background px-3 font-mono"
            >
              {`${primaryWallet.address.slice(0, 6)}...${primaryWallet.address.slice(-4)}`}
            </button>
          ) : (
            <button
              type="button"
              aria-label="Connect Wallet"
              onClick={() => setShowAuthFlow(true)}
              className="ml-2 inline-flex h-9 items-center justify-center rounded-xl border-2 border-primary/30 bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-300 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background px-3 gap-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5"
              >
                <path d="M3 6.75A2.75 2.75 0 0 1 5.75 4h12.5A2.75 2.75 0 0 1 21 6.75v1.5H8.5a2.75 2.75 0 0 0-2.75 2.75v2.5A2.75 2.75 0 0 0 8.5 16.25H21v1a2.75 2.75 0 0 1-2.75 2.75H5.75A2.75 2.75 0 0 1 3 17.25V6.75Zm18 4.5H8.5a1.25 1.25 0 0 0 0 2.5H21v-2.5Zm-4 1.25a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2h-1Z" />
              </svg>
              Connect
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}