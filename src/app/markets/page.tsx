'use client';

import { useState, useEffect } from 'react';
import { toOddsSportKey, toShortSportKey } from '@/lib/config/sports';
import Link from 'next/link';

interface Sport {
  key: string;
  group: string;
  title: string;
  description: string;
  active: boolean;
  has_outrights: boolean;
}

interface Market {
  sport_key: string;
  event_id: string;
  market_type: string;
  total_volume: number;
  active_bets: number;
}

export default function MarketsPage() {
  const [sports, setSports] = useState<Sport[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedSport, setSelectedSport] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSports();
  }, []);

  useEffect(() => {
    if (selectedSport) {
      fetchMarkets(selectedSport);
    }
  }, [selectedSport]);

  const fetchSports = async () => {
    try {
      const response = await fetch('/api/odds/sports');
      const data = await response.json();
      // Map incoming odds keys to short keys for internal use
      const mapped = (Array.isArray(data) ? data : []).map((s: any) => ({
        ...s,
        key: toShortSportKey(s.key),
      }));
      setSports(mapped);
      if (mapped.length > 0) {
        setSelectedSport(mapped[0].key);
      }
    } catch (error) {
      console.error('Failed to fetch sports:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMarkets = async (sportKey: string) => {
    try {
      const oddsKey = toOddsSportKey(sportKey);
      const response = await fetch(`/api/odds/${oddsKey}`);
      const data = await response.json();
      // Transform odds data into market format
      const marketData = data.map((event: any) => ({
        sport_key: sportKey,
        event_id: event.id,
        market_type: 'h2h',
        total_volume: Math.random() * 100000, // Mock data
        active_bets: Math.floor(Math.random() * 50),
      }));
      setMarkets(marketData);
    } catch (error) {
      console.error('Failed to fetch markets:', error);
    }
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `$${(volume / 1000).toFixed(1)}K`;
    return `$${volume.toFixed(0)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <p className="text-cyan-400 text-xl">Loading Markets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 pt-16">
      {/* Header */}
      <div className="border-b border-cyan-500/20 bg-black/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
            Live Markets
          </h1>
          <p className="text-gray-300 mt-2">Explore active betting markets across all sports</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sports Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-black/40 backdrop-blur-sm border border-cyan-500/20 rounded-xl p-6">
              <h2 className="text-xl font-bold text-cyan-400 mb-4">Sports</h2>
              <div className="space-y-2">
                {sports.map((sport) => (
                  <button
                    key={sport.key}
                    onClick={() => setSelectedSport(sport.key)}
                    className={`w-full text-left p-3 rounded-lg transition-all duration-200 ${
                      selectedSport === sport.key
                        ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-400/50 text-cyan-400'
                        : 'hover:bg-white/5 text-gray-300 hover:text-white'
                    }`}
                  >
                    <div className="font-medium">{sport.title}</div>
                    <div className="text-sm opacity-70">{sport.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Markets Grid */}
          <div className="lg:col-span-3">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">
                {sports.find(s => s.key === selectedSport)?.title || 'Markets'}
              </h2>
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-400">
                  <span className="text-cyan-400">{markets.length}</span> active markets
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-green-400 text-sm">Live</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {markets.map((market, index) => (
                <Link
                  key={`${market.event_id}-${index}`}
                  href={`/events/${market.event_id}`}
                  className="group"
                >
                  <div className="bg-black/40 backdrop-blur-sm border border-cyan-500/20 rounded-xl p-6 hover:border-cyan-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/20">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                        <span className="text-green-400 text-sm font-medium">LIVE</span>
                      </div>
                      <div className="text-cyan-400 text-sm">
                        {market.market_type.toUpperCase()}
                      </div>
                    </div>

                    <div className="mb-4">
                      <h3 className="text-white font-bold text-lg mb-2 group-hover:text-cyan-400 transition-colors">
                        Event #{market.event_id.slice(-8)}
                      </h3>
                      <p className="text-gray-400 text-sm">
                        {market.sport_key.replace(/_/g, ' ').toUpperCase()}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-400">Volume</div>
                        <div className="text-cyan-400 font-bold">
                          {formatVolume(market.total_volume)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400">Active Bets</div>
                        <div className="text-purple-400 font-bold">
                          {market.active_bets}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-700">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Market Health</span>
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <span className="text-green-400">Active</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {markets.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-400 text-lg mb-2">No active markets</div>
                <p className="text-gray-500">
                  Select a sport to view available betting markets
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}