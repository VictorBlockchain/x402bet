'use client';

import { useState, useEffect } from 'react';
import SportsBar from '@/components/SportsBar';
import LiveGames from '@/components/LiveGames';
import UpcomingGamesTable from '@/components/UpcomingGamesTable';

export default function Home() {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [selectedSport, setSelectedSport] = useState<string>('basketball_nba');

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleString());
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSportSelect = (sportKey: string) => {
    setSelectedSport(sportKey);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 pt-16">
      <SportsBar onSelect={handleSportSelect} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-24">
        {/* Hero Section */}
        <div className="relative text-center mb-16 overflow-hidden">
          {/* Main content */}
          <div className="relative z-10">
            {/* Platform branding */}
            {/* <div className="mb-8">              
              <div className="space-y-1">
                <h1 className="text-5xl md:text-6xl font-black tracking-tight">
                  <span className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
                    X402Bet
                  </span>
                </h1>
                <div className="text-xl md:text-2xl font-light text-foreground/70 tracking-wide">
                  Sports Gaming
                </div>
              </div>
            </div> */}
            
            {/* Enhanced description */}
            <div className="max-w-2xl mx-auto">
              <div className="relative">
                {/* Background decoration */}
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-purple-500/5 to-pink-500/5 rounded-2xl blur-xl"></div>
                
                {/* Content */}
                <div className="relative bg-card/30 backdrop-blur-sm border border-border/50 rounded-2xl p-8">
                  <div className="flex items-center justify-center mb-4">
                    <div className="px-4 py-2 bg-gradient-to-r from-primary/10 to-purple-500/10 rounded-full border border-primary/20">
                      <span className="text-sm font-semibold text-primary uppercase tracking-wider">
                        Sports Betting for AI Agents
                        <br/><small>built on SEI</small>
                      </span>
                    </div>
                  </div>

                </div>
              </div>
              
              {/* Stats or features */}
              {/* <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="p-4 bg-gradient-to-r from-primary/10 to-purple-500/10 rounded-xl border border-primary/20">
                  <div className="text-2xl font-bold text-primary">Live</div>
                  <div className="text-sm text-muted-foreground">Games</div>
                </div>
                <div className="p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-500/20">
                  <div className="text-2xl font-bold text-purple-500">Multi</div>
                  <div className="text-sm text-muted-foreground">Token</div>
                </div>
                <div className="p-4 bg-gradient-to-r from-pink-500/10 to-orange-500/10 rounded-xl border border-pink-500/20">
                  <div className="text-2xl font-bold text-pink-500">Real</div>
                  <div className="text-sm text-muted-foreground">Time</div>
                </div>
              </div> */}
            </div>
            
            {/* Time display with enhanced styling */}
            {/* <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary/10 to-purple-500/10 rounded-full border border-primary/20 backdrop-blur-sm">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-foreground/80">
                {currentTime}
              </span>
            </div> */}
          </div>
        </div>

        {/* Live Games with enhanced container */}
        <div className="mb-12">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-purple-500/5 rounded-2xl blur-xl"></div>
            <div className="relative bg-card/50 backdrop-blur-sm border border-border rounded-2xl p-6">
              <LiveGames sportKey={selectedSport} />
            </div>
          </div>
        </div>

        {/* Upcoming Games with enhanced container */}
        <div className="mb-12">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-pink-500/5 rounded-2xl blur-xl"></div>
            <div className="relative bg-card/50 backdrop-blur-sm border border-border rounded-2xl p-6">
              <UpcomingGamesTable sportKey={selectedSport} />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}