'use client';

import { useEffect, useMemo, useState } from 'react';
import { toOddsSportKey } from '@/lib/config/sports';
import BetModal from '@/components/modals/bet';

type SortOption = 'date' | 'league' | 'bookmaker' | 'popularity';

interface UpcomingGamesProps {
  sportKey?: string; // short key like 'nba'
}

type UpcomingGame = {
  id: string;
  date: string;
  time: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  bookmaker: string;
  homeOdds: number;
  awayOdds: number;
  overUnder: number | null;
  homeSpreadPoint: number | null;
  homeSpreadPrice: number | null;
  awaySpreadPoint: number | null;
  awaySpreadPrice: number | null;
  popularity: number;
  isPrimeTime: boolean;
};

function normalizeTeamName(name: string, sportKey?: string): string {
  const cleaned = name.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const parts = cleaned.split(' ');
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1].toLowerCase();
  const secondLast = parts[parts.length - 2]?.toLowerCase();
  const genericLast = new Set(['fc', 'sc', 'cf', 'city', 'united', 'real']);
  if (genericLast.has(last) && parts.length >= 2) return parts.slice(-2).join(' ');
  const twoWordNicknames: Record<string, Array<[string, string]>> = {
    basketball_nba: [['trail', 'blazers']],
    baseball_mlb: [['red', 'sox'], ['white', 'sox'], ['blue', 'jays']],
    icehockey_nhl: [['golden', 'knights'], ['blue', 'jackets'], ['maple', 'leafs']],
    americanfootball_nfl: [],
  };
  const combos = sportKey ? twoWordNicknames[sportKey] || [] : [];
  if (secondLast && combos.some(([a, b]) => a === secondLast && b === last)) {
    return parts.slice(-2).join(' ');
  }
  return parts[parts.length - 1];
}

export default function UpcomingGamesTable({ sportKey = 'nba' }: UpcomingGamesProps) {
  const SPORT_LABELS: Record<string, string> = {
    nba: 'Basketball',
    nfl: 'American Football',
    epl: 'Soccer',
    mlb: 'Baseball',
    cricket: 'Cricket',
    ncaaf: 'College Football',
    ncaab: 'College Basketball',
    boxing: 'Boxing',
    any: 'Any Prediction',
  };
  const sportLabel = SPORT_LABELS[sportKey] ?? sportKey;
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [games, setGames] = useState<UpcomingGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [betOpen, setBetOpen] = useState(false);
  const [activeGame, setActiveGame] = useState<UpcomingGame | null>(null);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  useEffect(() => {
    const fetchUpcoming = async () => {
      try {
        setLoading(true);
        setError(null);
        const oddsKey = toOddsSportKey(sportKey);
        const resp = await fetch(`/mock/upcoming_${oddsKey}.json`);
        const json = await resp.json();
        const events = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
        const now = Date.now();
        const twoDaysMs = 2 * 24 * 60 * 60 * 1000;

        const mapped: UpcomingGame[] = events
          .filter((e: any) => {
            const ct = e?.commence_time ? Date.parse(e.commence_time) : null;
            return ct !== null && ct > now && ct - now <= twoDaysMs;
          })
          .map((e: any) => {
            const homeFull = e.home_team;
            const awayFull = e.away_team;
            const home = normalizeTeamName(homeFull, e.sport_key);
            const away = normalizeTeamName(awayFull, e.sport_key);

            let homeOdds: number | null = null;
            let awayOdds: number | null = null;
            let overUnder: number | null = null;
            let bookmakerTitle: string = '—';
            let homeSpreadPoint: number | null = null;
            let homeSpreadPrice: number | null = null;
            let awaySpreadPoint: number | null = null;
            let awaySpreadPrice: number | null = null;

            // Prefer spreads; fallback to h2h; get totals point
            for (const bm of e.bookmakers || []) {
              const spreads = (bm.markets || []).find((m: any) => m.key === 'spreads');
              const h2h = (bm.markets || []).find((m: any) => m.key === 'h2h');
              const totals = (bm.markets || []).find((m: any) => m.key === 'totals');

              if (totals && Array.isArray(totals.outcomes)) {
                const over = totals.outcomes.find((o: any) => (o.name || '').toLowerCase().includes('over'));
                if (over && typeof over.point === 'number') overUnder = over.point;
              }

              if (spreads && Array.isArray(spreads.outcomes)) {
                for (const oc of spreads.outcomes) {
                  if (oc.name === homeFull && typeof oc.price === 'number') homeOdds = oc.price;
                  if (oc.name === awayFull && typeof oc.price === 'number') awayOdds = oc.price;
                  if (oc.name === homeFull) {
                    if (typeof oc.point === 'number') homeSpreadPoint = oc.point;
                    if (typeof oc.price === 'number') homeSpreadPrice = oc.price;
                  }
                  if (oc.name === awayFull) {
                    if (typeof oc.point === 'number') awaySpreadPoint = oc.point;
                    if (typeof oc.price === 'number') awaySpreadPrice = oc.price;
                  }
                }
                bookmakerTitle = bm.title || bm.key || bookmakerTitle;
                break;
              }

              if (h2h && Array.isArray(h2h.outcomes)) {
                for (const oc of h2h.outcomes) {
                  if (oc.name === homeFull && typeof oc.price === 'number') homeOdds = oc.price;
                  if (oc.name === awayFull && typeof oc.price === 'number') awayOdds = oc.price;
                }
                bookmakerTitle = bm.title || bm.key || bookmakerTitle;
                // don't break; continue to see if any later bookmaker has spreads
              }
            }

            const ct = new Date(e.commence_time);
            const dateStr = ct.toLocaleDateString();
            const timeStr = ct.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

            return {
              id: e.id,
              date: dateStr,
              time: timeStr,
              homeTeam: home,
              awayTeam: away,
              league: (e.sport_key?.split('_').pop()?.toUpperCase() || e.sport_key?.toUpperCase()),
              bookmaker: bookmakerTitle,
              homeOdds: homeOdds ?? 0,
              awayOdds: awayOdds ?? 0,
              overUnder,
              homeSpreadPoint,
              homeSpreadPrice,
              awaySpreadPoint,
              awaySpreadPrice,
              popularity: Math.min(100, (e.bookmakers?.length || 1) * 10),
              isPrimeTime: timeStr.includes('PM'),
            };
          });

        setGames(mapped);
      } catch (err: any) {
        console.error('Failed to fetch upcoming games', err);
        setError('Failed to load upcoming games');
        setGames([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUpcoming();
    const interval = setInterval(fetchUpcoming, 60_000);
    return () => clearInterval(interval);
  }, [sportKey]);

  const sortedGames = useMemo(() => {
    const arr = [...games];
    switch (sortBy) {
      case 'date':
        return arr.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      case 'league':
        return arr.sort((a, b) => a.league.localeCompare(b.league));
      case 'bookmaker':
        return arr.sort((a, b) => a.bookmaker.localeCompare(b.bookmaker));
      case 'popularity':
        return arr.sort((a, b) => b.popularity - a.popularity);
      default:
        return arr;
    }
  }, [games, sortBy]);

  const pageCount = useMemo(() => {
    return Math.max(1, Math.ceil(sortedGames.length / pageSize));
  }, [sortedGames.length, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [sortBy, pageSize, games.length]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [pageCount, page]);

  const paginatedGames = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedGames.slice(start, start + pageSize);
  }, [sortedGames, page, pageSize]);

  return (
    <div className="space-y-6">
      {/* Exciting Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-chart-2 rounded-full animate-ping" />
            <div className="relative w-3 h-3 bg-chart-2 rounded-full animate-pulse" />
          </div>
          {/* <h2 className="text-2xl font-black tracking-tight text-foreground uppercase">
            Next Games
          </h2> */}
          <div className="flex items-center gap-2">
            <span className="bg-gradient-to-r from-chart-2 to-chart-3 text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse">
              {loading ? '…' : games.length} UPCOMING
            </span>

            {/* {error && (
              <span className="text-xs text-red-500 font-bold">{error}</span>
            )} */}
          </div>
        </div>
        
        {/* Enhanced Sort Dropdown */}
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="bg-gradient-to-r from-card to-card/80 border-2 border-primary/30 text-foreground px-4 py-2 rounded-xl text-sm font-bold shadow-lg hover:shadow-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none cursor-pointer hover:border-primary/50 hover:scale-105"
          >
            <option value="date">📅 Game Date</option>
            <option value="league">🏆 By League</option>
            <option value="bookmaker">🎰 Bookmaker</option>
            <option value="popularity">🔥 Most Popular</option>
          </select>
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>
      
      

      {loading && (
        <div className="rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-card via-card to-accent/30 p-8 text-center shadow-xl">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="relative w-4 h-4">
              <div className="absolute inset-0 bg-chart-2 rounded-full animate-ping" />
              <div className="relative w-4 h-4 bg-chart-2 rounded-full animate-pulse" />
            </div>
            <span className="text-xl font-black uppercase tracking-wide">Loading Upcoming Games</span>
          </div>
          <p className="text-sm text-muted-foreground">Fetching schedules and odds…</p>
        </div>
      )}

      {!loading && sortedGames.length === 0 && (
        <div className="rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-card via-card to-accent/30 p-8 text-center shadow-xl">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-2xl">🗓️</span>
            <span className="text-xl font-black uppercase tracking-wide">No Upcoming Games</span>
          </div>
          <p className="text-sm text-muted-foreground">
            No upcoming {sportLabel} games found in the next 48 hours.
          </p>
        </div>
      )}

      {!loading && sortedGames.length > 0 && (
      <div className="bg-gradient-to-br from-card via-card to-accent/20 border-2 border-primary/40 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-primary/10 to-primary/5 border-b-2 border-primary/30">
              <tr className="text-left">
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-foreground">DATE/TIME</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-foreground">MATCHUP</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-foreground">LEAGUE</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-foreground">BOOKMAKER</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-foreground text-right">ODDS</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-foreground text-center">O/U</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-foreground text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {paginatedGames.map((game, index) => (
                <tr
                  key={game.id}
                  className={`group transition-all duration-300 cursor-pointer hover:bg-gradient-to-r hover:from-accent/30 hover:to-accent/20 hover:scale-[1.02] ${
                    index % 2 === 0 ? 'bg-background/50' : 'bg-muted/30'
                  }`}
                >
                  <td className="px-6 py-4">
                    <div className="relative">
                      {/* PRIME badge removed */}
                      <div className="text-foreground text-sm font-bold">{game.date}</div>
                      <div className="text-chart-1 text-xs font-black uppercase">{game.time}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="space-y-1">
                      <div className="text-foreground font-black text-sm group-hover:text-primary transition-colors">
                        {game.awayTeam}
                      </div>
                      <div className="text-muted-foreground text-xs font-black text-center">VS</div>
                      <div className="text-foreground font-black text-sm group-hover:text-primary transition-colors">
                        {game.homeTeam}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 text-primary px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:scale-110 transition-transform">
                      {game.league}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="bg-gradient-to-r from-accent/50 to-accent/30 text-accent-foreground px-3 py-1.5 rounded-lg text-xs font-black uppercase shadow-md hover:scale-110 transition-transform">
                        {game.bookmaker}
                      </span>
                      {game.popularity >= 90 && (
                        <div className="relative">
                          <div className="absolute inset-0 bg-chart-1 rounded-full animate-ping" />
                          <span className="relative text-chart-1 text-xs font-black">🔥</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right tabular-nums">
                    <div className="inline-flex gap-2">
                      <span className="bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 text-primary px-3 py-1.5 rounded-lg text-xs font-black tabular-nums hover:scale-110 transition-transform cursor-pointer shadow-md">
                        {game.homeOdds > 0 ? '+' : ''}{game.homeOdds}
                      </span>
                      <span className="bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 text-primary px-3 py-1.5 rounded-lg text-xs font-black tabular-nums hover:scale-110 transition-transform cursor-pointer shadow-md">
                        {game.awayOdds > 0 ? '+' : ''}{game.awayOdds}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className="bg-gradient-to-r from-chart-2/20 to-chart-3/20 text-chart-2 px-3 py-1.5 rounded-lg text-sm font-black tabular-nums shadow-md hover:scale-110 transition-transform">
                        {game.overUnder ?? '—'}
                      </span>
                      <div className="text-xs text-chart-2 font-black">O/U</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:scale-105 transition-transform shadow-lg hover:shadow-xl"
                      onClick={() => { setActiveGame(game); setBetOpen(true); }}
                    >
                      Place Bet
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Enhanced Table Footer */}
        <div className="bg-gradient-to-r from-primary/5 to-accent/10 border-t-2 border-primary/30 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-chart-2 rounded-full animate-pulse opacity-30" />
                <span className="relative text-chart-2 text-sm font-black">📊</span>
              </div>
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Live odds updated in real-time
              </span>
            </div>
            <div className="flex gap-2">
              <button className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:scale-105 transition-transform shadow-lg hover:shadow-xl">
                View All
              </button>
              <button className="bg-gradient-to-r from-accent to-accent/80 text-accent-foreground px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:scale-105 transition-transform shadow-lg hover:shadow-xl">
                Filter
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Pagination controls moved below the table */}
      {!loading && sortedGames.length > 0 && (
        <div className="flex items-center justify-between bg-gradient-to-r from-card/80 to-card/60 border-2 border-primary/30 rounded-xl px-4 py-3">
          <div className="text-xs text-muted-foreground font-bold">
            Showing {sortedGames.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, sortedGames.length)} of {sortedGames.length}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="bg-gradient-to-r from-muted to-muted/70 text-muted-foreground px-3 py-1.5 rounded-lg text-xs font-black hover:scale-105 transition-transform"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <span className="text-xs font-black text-foreground">
              Page {page} / {pageCount}
            </span>
            <button
              className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-black hover:scale-105 transition-transform disabled:opacity-60"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              Next
            </button>
            <select
              value={String(pageSize)}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="ml-2 bg-gradient-to-r from-card to-card/80 border-2 border-primary/30 text-foreground px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm focus:outline-none"
            >
              <option value="5">5 / page</option>
              <option value="10">10 / page</option>
              <option value="20">20 / page</option>
            </select>
          </div>
        </div>
      )}
      {betOpen && activeGame && (
        <BetModal
          isOpen={betOpen}
          onClose={() => setBetOpen(false)}
          game={{
            id: activeGame.id,
            homeTeam: activeGame.homeTeam,
            awayTeam: activeGame.awayTeam,
            league: activeGame.league,
            date: activeGame.date,
            time: activeGame.time,
            homeScore: 0,
            awayScore: 0,
            odds: { home: activeGame.homeOdds, away: activeGame.awayOdds },
            spreads: {
              homePoint: activeGame.homeSpreadPoint ?? undefined,
              homePrice: activeGame.homeSpreadPrice ?? undefined,
              awayPoint: activeGame.awaySpreadPoint ?? undefined,
              awayPrice: activeGame.awaySpreadPrice ?? undefined,
            },
          }}
          isLive={false}
        />
      )}
    </div>
  );
}