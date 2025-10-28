'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface Bookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: Market[];
}

interface Market {
  key: string;
  last_update: string;
  outcomes: Outcome[];
}

interface Outcome {
  name: string;
  price: number;
  point?: number;
}

interface Event {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Bookmaker[];
}

export default function EventPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const [event, setEvent] = useState<Event | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<string>('h2h');
  const [loading, setLoading] = useState(true);
  const [showBetBuilder, setShowBetBuilder] = useState(false);
  const [selectedBet, setSelectedBet] = useState<{
    bookmaker: string;
    market: string;
    outcome: Outcome;
  } | null>(null);
  const [stake, setStake] = useState<number>(0);
  const [placing, setPlacing] = useState<boolean>(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [placeSuccess, setPlaceSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchEvent();
  }, [eventId]);

  const fetchEvent = async () => {
    try {
      // Mock event data - in real app, this would fetch from your API
      const mockEvent: Event = {
        id: eventId,
        sport_key: 'basketball_nba',
        sport_title: 'NBA',
        commence_time: new Date(Date.now() + 3600000).toISOString(),
        home_team: 'Los Angeles Lakers',
        away_team: 'Golden State Warriors',
        bookmakers: [
          {
            key: 'draftkings',
            title: 'DraftKings',
            last_update: new Date().toISOString(),
            markets: [
              {
                key: 'h2h',
                last_update: new Date().toISOString(),
                outcomes: [
                  { name: 'Los Angeles Lakers', price: -110 },
                  { name: 'Golden State Warriors', price: -110 }
                ]
              },
              {
                key: 'spreads',
                last_update: new Date().toISOString(),
                outcomes: [
                  { name: 'Los Angeles Lakers', price: -110, point: -2.5 },
                  { name: 'Golden State Warriors', price: -110, point: 2.5 }
                ]
              },
              {
                key: 'totals',
                last_update: new Date().toISOString(),
                outcomes: [
                  { name: 'Over', price: -110, point: 225.5 },
                  { name: 'Under', price: -110, point: 225.5 }
                ]
              }
            ]
          }
        ]
      };
      setEvent(mockEvent);
    } catch (error) {
      console.error('Failed to fetch event:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatOdds = (price: number) => {
    return price > 0 ? `+${price}` : `${price}`;
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleString();
  };

  const handleBetClick = (bookmaker: string, market: string, outcome: Outcome) => {
    setSelectedBet({ bookmaker, market, outcome });
    setShowBetBuilder(true);
    setStake(0);
    setPlaceError(null);
    setPlaceSuccess(null);
  };

  const potentialPayoutAmerican = (s: number, odds: number) => {
    if (odds > 0) return s + (s * odds) / 100;
    return s + (s * 100) / Math.abs(odds);
  };

  const handlePlaceBet = async () => {
    if (!selectedBet || stake <= 0) {
      setPlaceError('Enter a valid stake amount');
      return;
    }
    setPlacing(true);
    setPlaceError(null);
    setPlaceSuccess(null);

    const payload = {
      user_id: '00000000-0000-0000-0000-000000000000', // TODO: replace with authenticated user id
      sport_key: event!.sport_key,
      event_id: event!.id,
      market_type: selectedBet.market as 'h2h' | 'spreads' | 'totals',
      selection: selectedBet.outcome.name,
      odds: selectedBet.outcome.price,
      odds_format: 'american' as const,
      stake,
      bookmaker: selectedBet.bookmaker,
      event_data: {
        home_team: event!.home_team,
        away_team: event!.away_team,
        commence_time: event!.commence_time,
      },
    };

    try {
      const res = await fetch('/api/bets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to place bet');
      }
      setPlaceSuccess(`Bet placed! ID: ${data.bet.id.slice(0, 8)}`);
    } catch (err: any) {
      setPlaceError(err.message);
    } finally {
      setPlacing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <p className="text-cyan-400 text-xl">Loading Event...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-xl">Event not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 pt-16">
      {/* Header */}
      <div className="border-b border-cyan-500/20 bg-black/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <span className="bg-gradient-to-r from-cyan-400 to-purple-400 text-black px-3 py-1 rounded-full text-sm font-bold">
                  {event.sport_title}
                </span>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-green-400 text-sm">LIVE ODDS</span>
                </div>
              </div>
              <h1 className="text-4xl font-bold text-white mb-2">
                {event.away_team} <span className="text-cyan-400">@</span> {event.home_team}
              </h1>
              <p className="text-gray-300">
                {formatTime(event.commence_time)}
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400 mb-1">Event ID</div>
              <div className="text-cyan-400 font-mono">{event.id.slice(-8)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Market Selector */}
        <div className="mb-8">
          <div className="flex space-x-4">
            {['h2h', 'spreads', 'totals'].map((market) => (
              <button
                key={market}
                onClick={() => setSelectedMarket(market)}
                className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                  selectedMarket === market
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg'
                    : 'bg-black/40 text-gray-300 hover:bg-white/10 hover:text-white border border-gray-600'
                }`}
              >
                {market === 'h2h' ? 'Moneyline' : market === 'spreads' ? 'Point Spread' : 'Over/Under'}
              </button>
            ))}
          </div>
        </div>

        {/* Odds Grid */}
        <div className="space-y-6">
          {event.bookmakers.map((bookmaker) => {
            const market = bookmaker.markets.find(m => m.key === selectedMarket);
            if (!market) return null;

            return (
              <div key={bookmaker.key} className="bg-black/40 backdrop-blur-sm border border-cyan-500/20 rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-white">{bookmaker.title}</h3>
                  <div className="text-sm text-gray-400">
                    Updated: {new Date(market.last_update).toLocaleTimeString()}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {market.outcomes.map((outcome, index) => (
                    <button
                      key={index}
                      onClick={() => handleBetClick(bookmaker.key, selectedMarket, outcome)}
                      className="group bg-gradient-to-r from-gray-800 to-gray-700 hover:from-cyan-600/20 hover:to-purple-600/20 border border-gray-600 hover:border-cyan-400/50 rounded-lg p-4 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/20"
                    >
                      <div className="text-left">
                        <div className="text-white font-medium mb-1 group-hover:text-cyan-400 transition-colors">
                          {outcome.name}
                        </div>
                        {outcome.point !== undefined && (
                          <div className="text-gray-400 text-sm mb-2">
                            {selectedMarket === 'spreads' 
                              ? `${outcome.point > 0 ? '+' : ''}${outcome.point}`
                              : `${outcome.point}`
                            }
                          </div>
                        )}
                        <div className="text-2xl font-bold text-cyan-400">
                          {formatOdds(outcome.price)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Event Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-black/40 backdrop-blur-sm border border-cyan-500/20 rounded-xl p-6">
            <h4 className="text-cyan-400 font-bold mb-2">Market Volume</h4>
            <div className="text-3xl font-bold text-white">$127.5K</div>
            <div className="text-green-400 text-sm">+15.2% from yesterday</div>
          </div>
          <div className="bg-black/40 backdrop-blur-sm border border-cyan-500/20 rounded-xl p-6">
            <h4 className="text-purple-400 font-bold mb-2">Active Bets</h4>
            <div className="text-3xl font-bold text-white">342</div>
            <div className="text-blue-400 text-sm">Across all markets</div>
          </div>
          <div className="bg-black/40 backdrop-blur-sm border border-cyan-500/20 rounded-xl p-6">
            <h4 className="text-yellow-400 font-bold mb-2">Avg Stake</h4>
            <div className="text-3xl font-bold text-white">$373</div>
            <div className="text-gray-400 text-sm">Per bet placed</div>
          </div>
        </div>
      </div>

      {/* Bet Builder Modal */}
      {showBetBuilder && selectedBet && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-gray-900 to-black border border-cyan-500/30 rounded-2xl p-8 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">Place Bet</h3>
              <button
                onClick={() => setShowBetBuilder(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-black/40 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Selection</div>
                <div className="text-white font-bold">{selectedBet.outcome.name}</div>
                <div className="text-cyan-400 text-lg font-bold">
                  {formatOdds(selectedBet.outcome.price)}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Stake Amount</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={stake || ''}
                  onChange={(e) => setStake(parseFloat(e.target.value) || 0)}
                  className="w-full bg-black/40 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="bg-black/40 rounded-lg p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Potential Payout</span>
                  <span className="text-green-400 font-bold">
                    ${selectedBet ? potentialPayoutAmerican(stake, selectedBet.outcome.price).toFixed(2) : '0.00'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Potential Profit</span>
                  <span className="text-cyan-400 font-bold">
                    ${selectedBet ? (potentialPayoutAmerican(stake, selectedBet.outcome.price) - stake).toFixed(2) : '0.00'}
                  </span>
                </div>
              </div>
              {placeError && <div className="text-red-400 text-sm">{placeError}</div>}
              {placeSuccess && <div className="text-green-400 text-sm">{placeSuccess}</div>}

              <button
                onClick={handlePlaceBet}
                disabled={placing}
                className={`w-full bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold py-4 rounded-lg transition-all duration-300 ${
                  placing ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-lg hover:shadow-cyan-500/30'
                }`}
              >
                {placing ? 'Placing...' : 'Place Bet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}