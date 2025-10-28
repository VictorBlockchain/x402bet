'use client';

import { useEffect, useRef, useState } from 'react';

// Use short keys internally and map to Odds API keys where needed
const sports = [
  { key: 'nba', name: 'Basketball', icon: '🏀', popularity: 95 },
  { key: 'nfl', name: 'American Football', icon: '🏈', popularity: 88 },
  { key: 'epl', name: 'Soccer', icon: '⚽', popularity: 92 },
  { key: 'mlb', name: 'Baseball', icon: '⚾', popularity: 76 },
  { key: 'cricket', name: 'Cricket', icon: '🏏', popularity: 65 },
  { key: 'ncaaf', name: 'College Football', icon: '🏈', popularity: 72 },
  { key: 'ncaab', name: 'College Basketball', icon: '🏀', popularity: 68 },
  { key: 'boxing', name: 'Boxing', icon: '🥊', popularity: 80 },
  { key: 'any', name: 'Any Prediction', icon: '🎯', popularity: 100 },
];

interface SportsBarProps {
  onSelect?: (sportKey: string) => void;
}

export default function SportsBar({ onSelect }: SportsBarProps) {
  const [selectedSport, setSelectedSport] = useState<string>('nba');
  const desktopListRef = useRef<HTMLDivElement | null>(null);
  const mobileListRef = useRef<HTMLDivElement | null>(null);
  const [desktopUnderline, setDesktopUnderline] = useState<{ left: number; width: number }>({ left: 0, width: 0 });
  const [mobileUnderline, setMobileUnderline] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  const handleSelect = (sportKey: string) => {
    setSelectedSport(sportKey);
    onSelect?.(sportKey);
  };

  const updateUnderline = (
    ref: React.RefObject<HTMLDivElement | null>,
    setter: (v: { left: number; width: number }) => void
  ) => {
    const listEl = ref.current;
    if (!listEl) return;
    const btn = listEl.querySelector(`[data-sport-key="${selectedSport}"]`) as HTMLElement | null;
    if (!btn) return;
    // Position relative to the list container
    const left = btn.offsetLeft;
    const width = btn.offsetWidth;
    setter({ left, width });
  };

  useEffect(() => {
    updateUnderline(desktopListRef, setDesktopUnderline);
    updateUnderline(mobileListRef, setMobileUnderline);
  }, [selectedSport]);

  useEffect(() => {
    const onResize = () => {
      updateUnderline(desktopListRef, setDesktopUnderline);
      updateUnderline(mobileListRef, setMobileUnderline);
    };
    window.addEventListener('resize', onResize);
    // Initial measure
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Removed live count polling and badge UI

  return (
    <div className="sticky top-16 z-40">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 bg-background/90 backdrop-blur-xl border-b border-border/50 shadow-sm">
        <div className="py-3">
          {/* Desktop: Full text */}
          <div ref={desktopListRef} className="hidden md:flex relative items-center justify-start gap-1 overflow-x-auto no-scrollbar whitespace-nowrap">
          {sports.map((sport) => (
            <button
              key={sport.key}
              onClick={() => handleSelect(sport.key)}
              className={`group relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all duration-300 ease-out rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                selectedSport === sport.key
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
              data-sport-key={sport.key}
            >
              {/* Icon */}
              <span className={`text-lg transition-transform duration-300 ${
                selectedSport === sport.key ? 'scale-110' : 'group-hover:scale-110'
              }`}>
                {sport.icon}
              </span>
              
              {/* Text - Desktop only */}
              <span className="font-medium">
                {sport.name}
              </span>
              
              {/* Popularity indicator */}
              {sport.popularity >= 90 && (
                <div className="absolute -top-1 -right-1">
                  <span className="text-chart-1 text-xs">🔥</span>
                </div>
              )}
            </button>
          ))}
          {/* Animated active underline */}
          <div
            className="absolute bottom-0 h-0.5 rounded-full bg-gradient-to-r from-chart-1 to-chart-2 shadow-sm transition-all duration-300 ease-out"
            style={{ left: desktopUnderline.left, width: desktopUnderline.width }}
          />
        </div>

        {/* Mobile: Icons only */}
        <div ref={mobileListRef} className="md:hidden relative flex items-center justify-start gap-2 overflow-x-auto no-scrollbar whitespace-nowrap">
          {sports.map((sport) => (
            <button
              key={sport.key}
              onClick={() => handleSelect(sport.key)}
              className={`group relative flex items-center justify-center w-12 h-12 transition-all duration-300 ease-out rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                selectedSport === sport.key
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
              title={sport.name} // Tooltip for mobile
              data-sport-key={sport.key}
            >
              {/* Icon */}
              <span className={`text-xl transition-transform duration-300 ${
                selectedSport === sport.key ? 'scale-125' : 'group-hover:scale-125'
              }`}>
                {sport.icon}
              </span>
              
              {/* Popularity indicator */}
              {sport.popularity >= 90 && (
                <div className="absolute -top-0.5 -right-0.5">
                  <span className="text-chart-1 text-xs">🔥</span>
                </div>
              )}
            </button>
          ))}
          {/* Animated active underline - mobile */}
          <div
            className="absolute bottom-0 h-0.5 rounded-full bg-gradient-to-r from-chart-1 to-chart-2 shadow-sm transition-all duration-300 ease-out"
            style={{ left: mobileUnderline.left, width: mobileUnderline.width }}
          />
        </div>
        
        {/* Removed static indicator; active underline animates under selected item */}
        </div>
      </div>
    </div>
  );
}
