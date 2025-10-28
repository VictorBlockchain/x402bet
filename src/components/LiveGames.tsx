"use client";

import { useEffect, useMemo, useState } from "react";
import { toOddsSportKey } from "@/lib/config/sports";
import { normalizeTeamName, calculateMomentum, formatGameTime, canPlaceBet } from "@/lib/utils/teams";
import BetModal from "./modals/bet";

type SortOption = "popularity" | "time" | "league";

type LiveGame = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  sport: string;
  league: string;
  time: string;
  startedMinutesAgo: number;
  canBet: boolean;
  homeScore: number;
  awayScore: number;
  popularity: number;
  odds: { home: number; away: number };
  homeSpreadPoint: number | null;
  homeSpreadPrice: number | null;
  awaySpreadPoint: number | null;
  awaySpreadPrice: number | null;
  momentum: "home" | "away" | "neutral";
  streak: string;
};

interface LiveGamesProps {
  sportKey?: string; // short key like "nba"
}

export default function LiveGames({ sportKey = "nba" }: LiveGamesProps) {
  const SPORT_LABELS: Record<string, string> = {
    nba: "Basketball",
    nfl: "American Football",
    epl: "Soccer",
    mlb: "Baseball",
    cricket: "Cricket",
    ncaaf: "College Football",
    ncaab: "College Basketball",
    boxing: "Boxing",
    any: "Any Prediction",
  };
  const sportLabel = SPORT_LABELS[sportKey] ?? sportKey;
  const [sortBy, setSortBy] = useState<SortOption>("popularity");
  const [games, setGames] = useState<LiveGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [betOpen, setBetOpen] = useState(false);
  const [activeGame, setActiveGame] = useState<LiveGame | null>(null);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(6);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        if (isInitialLoad) setLoading(true);
        setError(null);
        const oddsKey = toOddsSportKey(sportKey);
        
        // Fetch from the new live-games API endpoint
        const response = await fetch(`/api/live-games?sport=${oddsKey}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch live games: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.success || !Array.isArray(data.games)) {
          throw new Error('Invalid response format from live games API');
        }

        const now = Date.now();

        const mapped: LiveGame[] = data.games.map((game: any) => {
          const home = normalizeTeamName(game.home_team, game.sport_key);
          const away = normalizeTeamName(game.away_team, game.sport_key);
          
          const startTime = game.start_time ? new Date(game.start_time) : new Date();
          const minsAgo = Math.max(0, Math.floor((now - startTime.getTime()) / 60000));
          
          // Calculate momentum based on scores
           const momentum = calculateMomentum(game.home_score || 0, game.away_score || 0);
           
           // Format game time
           const gameTime = formatGameTime(startTime, true); // true indicates it's live
           
           // Check if betting is allowed
           const canBet = canPlaceBet(startTime, game.cutoff_time);

          return {
            id: game.event_id,
            homeTeam: home,
            awayTeam: away,
            sport: game.sport_key,
            league: game.sport_key,
            time: gameTime,
            startedMinutesAgo: minsAgo,
            canBet,
            homeScore: game.home_score || 0,
            awayScore: game.away_score || 0,
            popularity: game.hasOdds ? 80 : 40, // Higher popularity if odds are available
            odds: {
              home: game.homeOdds || 0,
              away: game.awayOdds || 0,
            },
            homeSpreadPoint: game.homeSpreadPoint,
            homeSpreadPrice: game.homeSpreadPrice,
            awaySpreadPoint: game.awaySpreadPoint,
            awaySpreadPrice: game.awaySpreadPrice,
            momentum,
            streak: "LIVE",
          };
        });

        setGames(mapped);
      } catch (err: any) {
        console.error("Failed to fetch live games", err);
        setError("Failed to load live games");
        setGames([]);
      } finally {
        setLoading(false);
        if (isInitialLoad) setIsInitialLoad(false);
      }
    };

    fetchGames();
    const interval = setInterval(fetchGames, 30_000);
    return () => clearInterval(interval);
  }, [sportKey]);

  const sortedGames = useMemo(() => {
    const arr = [...games];
    switch (sortBy) {
      case "popularity":
        return arr.sort((a, b) => b.popularity - a.popularity);
      case "time":
        return arr.sort((a, b) => a.time.localeCompare(b.time));
      case "league":
        return arr.sort((a, b) => a.league.localeCompare(b.league));
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-chart-1 rounded-full animate-ping" />
            <div className="relative w-3 h-3 bg-chart-1 rounded-full animate-pulse" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-foreground uppercase">
            Live Action
          </h2>
          <div className="flex items-center gap-2">
            <span className="bg-gradient-to-r from-chart-1 to-chart-2 text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse">
              {loading ? "…" : games.length} LIVE
            </span>
            <span className="text-xs text-muted-foreground font-medium animate-pulse">
              ● NOW
            </span>
          </div>
        </div>

        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="bg-gradient-to-r from-card to-card/80 border-2 border-primary/30 text-foreground px-4 py-2 rounded-xl text-sm font-bold shadow-lg hover:shadow-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none cursor-pointer hover:border-primary/50 hover:scale-105"
          >
            <option value="popularity">🔥 Trending</option>
            <option value="time">⏰ Game Time</option>
            <option value="league">🏆 By League</option>
          </select>
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      

      {loading && isInitialLoad && (
        <div className="rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-card via-card to-accent/30 p-8 text-center shadow-xl">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="relative w-4 h-4">
              <div className="absolute inset-0 bg-chart-1 rounded-full animate-ping" />
              <div className="relative w-4 h-4 bg-chart-1 rounded-full animate-pulse" />
            </div>
            <span className="text-xl font-black uppercase tracking-wide">Loading Live Games</span>
          </div>
          <p className="text-sm text-muted-foreground">Fetching odds and scores…</p>
        </div>
      )}

      {sortedGames.length === 0 && !loading && (
        <div className="rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-card via-card to-accent/30 p-8 text-center shadow-xl min-h-[180px]">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-2xl">🕒</span>
            <span className="text-xl font-black uppercase tracking-wide">No Live Games</span>
          </div>
          <p className="text-sm text-muted-foreground">
            No live {sportLabel} games are available right now. Try another sport or check upcoming matches.
          </p>
        </div>
      )}

      {!loading && sortedGames.length > 0 && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedGames.map((game) => (
          <div
            key={game.id}
            className="group relative bg-gradient-to-br from-card via-card to-accent/20 border-2 border-primary/40 rounded-2xl p-6 shadow-xl transition-all duration-300 cursor-pointer hover:shadow-2xl hover:-translate-y-2 hover:border-primary/60 hover:scale-105 hover:rotate-1"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-chart-1/20 to-primary/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-pulse" />

            <div className="absolute -top-2 -right-2 bg-gradient-to-r from-chart-1 to-chart-2 text-white px-3 py-1 rounded-full text-xs font-black uppercase animate-bounce shadow-lg">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                LIVE
              </div>
            </div>

            <div className="flex items-center justify-between mb-4">
              <div className="bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 text-primary px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-md">
                {game.league}
              </div>
              <div className="bg-gradient-to-r from-chart-1/20 to-chart-2/20 text-chart-1 px-2 py-1 rounded-lg text-xs font-bold animate-pulse">
                {game.time}
              </div>
            </div>

            <div className="text-center mb-4">
              <div className="flex items-center justify-between mb-4">
                <div className={`flex-1 text-right pr-3 transition-all duration-300 ${
                  game.momentum === "away" ? "scale-110" : "scale-100"
                }`}>
                  <div className={`font-black text-lg transition-colors whitespace-nowrap truncate ${
                    game.momentum === "away" ? "text-chart-1 animate-pulse" : "text-foreground group-hover:text-primary"
                  }`}>
                    {game.awayTeam}
                  </div>
                  {game.momentum === "away" && (
                    <div className="text-xs text-chart-1 font-bold animate-pulse">⚡ MOMENTUM</div>
                  )}
                  <div className="mt-1 flex justify-end">
                    <div className="bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 rounded-lg px-3 py-1.5 text-xs font-black tabular-nums hover:scale-110 transition-transform cursor-pointer">
                      {/* Away spread: point (price) */}
                      {game.awaySpreadPoint !== null ? (game.awaySpreadPoint > 0 ? "+" : "") : ""}{game.awaySpreadPoint ?? "—"}
                      {" "}
                      ({game.awaySpreadPrice !== null ? (game.awaySpreadPrice > 0 ? "+" : "") : ""}{game.awaySpreadPrice ?? "—"})
                    </div>
                  </div>
                </div>
                <div className="px-3">
                  <div className="text-muted-foreground font-black text-lg">VS</div>
                </div>
                <div className={`flex-1 text-left pl-3 transition-all duration-300 ${
                  game.momentum === "home" ? "scale-110" : "scale-100"
                }`}>
                  <div className={`font-black text-lg transition-colors whitespace-nowrap truncate ${
                    game.momentum === "home" ? "text-chart-1 animate-pulse" : "text-foreground group-hover:text-primary"
                  }`}>
                    {game.homeTeam}
                  </div>
                  {game.momentum === "home" && (
                    <div className="text-xs text-chart-1 font-bold animate-pulse">⚡ MOMENTUM</div>
                  )}
                  <div className="mt-1">
                    <div className="bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 rounded-lg px-3 py-1.5 text-xs font-black tabular-nums hover:scale-110 transition-transform cursor-pointer">
                      {/* Home spread: point (price) */}
                      {game.homeSpreadPoint !== null ? (game.homeSpreadPoint > 0 ? "+" : "") : ""}{game.homeSpreadPoint ?? "—"}
                      {" "}
                      ({game.homeSpreadPrice !== null ? (game.homeSpreadPrice > 0 ? "+" : "") : ""}{game.homeSpreadPrice ?? "—"})
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3">
                <div className={`relative transition-all duration-300 ${
                  game.awayScore > game.homeScore ? "scale-110" : "scale-100"
                }`}>
                  <div className={`bg-gradient-to-br ${
                    game.awayScore > game.homeScore 
                      ? "from-chart-1 to-chart-1/80 text-white" 
                      : "from-muted to-muted/80 text-foreground"
                  } rounded-xl px-6 py-3 min-w-[80px] text-center shadow-lg border-2 ${
                    game.awayScore > game.homeScore ? "border-chart-1" : "border-border"
                  }`}>
                    <div className="text-3xl font-black tabular-nums">
                      {game.awayScore}
                    </div>
                  </div>
                  {game.awayScore > game.homeScore && (
                    <div className="absolute -top-1 -right-1 text-chart-1 text-lg animate-bounce">🔥</div>
                  )}
                </div>

                <div className="text-muted-foreground font-black text-xl">-</div>

                <div className={`relative transition-all duration-300 ${
                  game.homeScore > game.awayScore ? "scale-110" : "scale-100"
                }`}>
                  <div className={`bg-gradient-to-br ${
                    game.homeScore > game.awayScore 
                      ? "from-chart-1 to-chart-1/80 text-white" 
                      : "from-muted to-muted/80 text-foreground"
                  } rounded-xl px-6 py-3 min-w-[80px] text-center shadow-lg border-2 ${
                    game.homeScore > game.awayScore ? "border-chart-1" : "border-border"
                  }`}>
                    <div className="text-3xl font-black tabular-nums">
                      {game.homeScore}
                    </div>
                  </div>
                  {game.homeScore > game.awayScore && (
                    <div className="absolute -top-1 -right-1 text-chart-1 text-lg animate-bounce">🔥</div>
                  )}
                </div>
              </div>

              <div className="mt-3 text-center">
                <span className="bg-gradient-to-r from-accent to-accent/50 text-accent-foreground px-3 py-1 rounded-full text-xs font-bold">
                  {game.streak}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end pt-4 border-t-2 border-border/50">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-chart-2 to-chart-1 rounded-full animate-pulse opacity-30" />
                  <span className="relative text-chart-2 text-lg font-black animate-pulse">🔥</span>
                </div>
                <span className="bg-gradient-to-r from-chart-2/20 to-chart-1/20 text-chart-2 px-2 py-1 rounded-lg text-sm font-black tabular-nums">
                  {game.popularity}%
                </span>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              {game.canBet ? (
                <button
                  className="flex-1 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:scale-105 transition-transform shadow-lg hover:shadow-xl"
                  onClick={() => { setActiveGame(game); setBetOpen(true); }}
                >
                  Bet Now
                </button>
              ) : (
                <span className="flex-1 bg-gradient-to-r from-muted to-muted/70 text-muted-foreground px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-center select-none">
                  Bet Closed
                </span>
              )}
              <a
                href={`/stats/${game.id}`}
                className="flex-1 bg-gradient-to-r from-accent to-accent/80 text-accent-foreground px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:scale-105 transition-transform shadow-lg hover:shadow-xl text-center"
              >
                Stats
              </a>
            </div>

            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          </div>
        ))}
      </div>
      )}

      {/* Pagination controls moved below the grid */}
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
              <option value="6">6 / page</option>
              <option value="9">9 / page</option>
              <option value="12">12 / page</option>
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
            homeScore: activeGame.homeScore,
            awayScore: activeGame.awayScore,
            odds: activeGame.odds,
          }}
          isLive={true}
          onPlaceBet={async ({ selectedTeam, selectedToken, amount }) => {
            if (!activeGame) return
            await handleContractBet({ game: activeGame, selectedTeam, tokenSymbol: selectedToken.symbol === 'SEI' ? 'SEI' : 'x402Bet', amount })
          }}
        />
      )}
    </div>
  );
}
  async function handleContractBet({ game, selectedTeam, tokenSymbol, amount }: { game: LiveGame; selectedTeam: 'home' | 'away'; tokenSymbol: 'SEI' | 'x402Bet'; amount: string }) {
    const { placeBet } = await import('@/lib/evm/betting')
    await placeBet({ eventId: game.id, selection: selectedTeam, amount, token: tokenSymbol })
  }