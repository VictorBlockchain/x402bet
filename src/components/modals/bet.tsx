'use client';

import { useState } from 'react';

interface BetModalProps {
  isOpen: boolean;
  onClose: () => void;
  game: {
    id: string;
    homeTeam: string;
    awayTeam: string;
    league: string;
    date?: string;
    time?: string;
    homeScore: number;
    awayScore: number;
    odds: { home: number; away: number };
    spreads?: { homePoint?: number; homePrice?: number; awayPoint?: number; awayPrice?: number };
  };
  isLive?: boolean;
  onPlaceBet?: (args: { game: BetModalProps['game']; selectedTeam: 'home' | 'away'; selectedToken: { symbol: string; name: string }; amount: string }) => Promise<void>;
}

const tokens = [
  { symbol: 'SEI', name: 'Sei Token', balance: 1250.50, icon: '🌊' },
  { symbol: 'x402Bet', name: 'x402Bet Token', balance: 10000.00, icon: '🎲' },
];

const quickAmounts = [10, 25, 50, 100, 250, 500];

export default function BetModal({ isOpen, onClose, game, isLive = true, onPlaceBet }: BetModalProps) {
  const [selectedTeam, setSelectedTeam] = useState<'home' | 'away'>('home');
  const [selectedToken, setSelectedToken] = useState(tokens[0]);
  const [betAmount, setBetAmount] = useState<string>('');
  const [isPlacingBet, setIsPlacingBet] = useState(false);

  if (!isOpen) return null;

  const handleQuickAmount = (amount: number) => {
    setBetAmount(amount.toString());
  };

  const handleMaxBet = () => {
    setBetAmount(selectedToken.balance.toString());
  };

  const handlePlaceBet = async () => {
    if (!betAmount || parseFloat(betAmount) <= 0) return;
    
    setIsPlacingBet(true);
    try {
      if (onPlaceBet) {
        await onPlaceBet({ game, selectedTeam, selectedToken: { symbol: selectedToken.symbol, name: selectedToken.name }, amount: betAmount });
      } else {
        // Fallback: simulate bet placement if no handler provided
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    } catch (e) {
      console.error('Place bet failed', e);
    }
    setIsPlacingBet(false);
    onClose();
  };

  // Compute potential win safely; guard against invalid or zero odds to avoid NaN/Infinity
  const computeMultiplier = (odds: number) => {
    if (!Number.isFinite(odds) || odds === 0) return 0; // no odds -> no multiplier
    return odds > 0 ? (odds / 100) + 1 : 1 - (100 / Math.abs(odds));
  };
  const baseAmount = parseFloat(betAmount || '0');
  const multiplier = selectedTeam === 'home' ? computeMultiplier(game.odds.home) : computeMultiplier(game.odds.away);
  const potentialWinRaw = baseAmount * multiplier;
  const potentialWin = Number.isFinite(potentialWinRaw) ? potentialWinRaw : 0;
  const totalPayoutRaw = baseAmount + potentialWin;
  const totalPayout = Number.isFinite(totalPayoutRaw) ? totalPayoutRaw : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-gradient-to-br from-card via-card to-accent/20 border-2 border-primary/40 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 border-b border-primary/30 px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-foreground uppercase tracking-tight">
              Bet via AI Agents Only
            </h3>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Game Info */}
        <div className="px-6 py-4 border-b border-border/50">
          <div className="flex items-center justify-between mb-3">
            <span className="bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 text-primary px-2 py-1 rounded-lg text-xs font-black uppercase tracking-wider">
              {game.league}
            </span>
            {isLive ? (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-chart-1 rounded-full animate-pulse" />
                <span className="text-chart-1 text-xs font-black uppercase">Live</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {game.date && (
                  <span className="bg-gradient-to-r from-card to-card/80 border border-border/60 text-foreground px-2 py-1 rounded-lg text-xs font-black">
                    {game.date}
                  </span>
                )}
                {game.time && (
                  <span className="bg-gradient-to-r from-card to-card/80 border border-border/60 text-muted-foreground px-2 py-1 rounded-lg text-xs font-black">
                    {game.time}
                  </span>
                )}
              </div>
            )}
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1 text-right pr-3">
                <div className="font-bold text-foreground">{game.awayTeam}</div>
                <div className="text-2xl font-black text-foreground">{game.awayScore}</div>
              </div>
              <div className="px-3 text-muted-foreground font-black">VS</div>
              <div className="flex-1 text-left pl-3">
                <div className="font-bold text-foreground">{game.homeTeam}</div>
                <div className="text-2xl font-black text-foreground">{game.homeScore}</div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Agents Only Message */}
        <div className="px-6 py-6">
          <div className="rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-card via-card to-accent/30 p-6 text-center shadow-xl">
            <div className="flex items-center justify-center gap-3 mb-2">
              <span className="text-2xl">🤖</span>
              <span className="text-xl font-black uppercase tracking-wide">AI Agents Only</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Manual betting is disabled. Bets are handled by autonomous AI agents
              to optimize execution, pricing, and risk. Connect with an agent or
              return to Live Games to browse markets.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-4 py-3 rounded-xl font-black uppercase tracking-wider transition-all duration-300 hover:from-primary/90 hover:to-primary/70 hover:scale-105"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
