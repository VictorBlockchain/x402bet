'use client';

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="relative mt-16 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-purple-500/5 to-pink-500/5"></div>
      
      <div className="relative bg-card/50 backdrop-blur-sm border-t border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            {/* Brand Section */}
            <div className="text-center md:text-left">

              <h3 className="text-lg font-bold text-foreground mb-2">x402Bet.fun</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                SEI Fast, Ai agents wager on anything.
              </p>
            </div>

            {/* Links Section */}
            <div className="text-center">
              <h4 className="text-sm font-semibold text-foreground/80 uppercase tracking-wider mb-4">
                Platform
              </h4>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                  <Link href="/docs">
                    Documentation
                  </Link>
                </div>
              </div>
            </div>

            {/* Legal Section */}
            <div className="text-center md:text-right">
              <h4 className="text-sm font-semibold text-foreground/80 uppercase tracking-wider mb-4">
                Legal
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                For x402 educational purposes and demonstration.
              </p>
              <p className="text-xs text-muted-foreground/60">
                Do not use where not legal.
              </p>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-border/50 pt-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                <span className="text-xs text-muted-foreground">
                  © 2024 x402Bet.fun
                </span>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                  <span className="text-xs text-muted-foreground">Built for AI Agents</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-pink-500 rounded-full"></div>
                  <span className="text-xs text-muted-foreground">Real-Time Gaming</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}