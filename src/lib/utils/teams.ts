/**
 * Team name normalization and utility functions
 */

/**
 * Normalizes team names for display by extracting the most recognizable part
 * @param name - Full team name
 * @param sportKey - Sport key for sport-specific rules
 * @returns Normalized team name
 */
export function normalizeTeamName(name: string, sportKey?: string): string {
  // Remove parenthetical qualifiers, trim whitespace
  const cleaned = name.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  const parts = cleaned.split(" ");
  if (parts.length === 1) return parts[0];

  const last = parts[parts.length - 1].toLowerCase();
  const secondLast = parts[parts.length - 2]?.toLowerCase();

  // Generic suffixes that should not stand alone
  const genericLast = new Set(["fc", "sc", "cf", "city", "united", "real"]);
  if (genericLast.has(last) && parts.length >= 2) {
    return parts.slice(-2).join(" ");
  }

  // Two-word nicknames for major US leagues
  const twoWordNicknames: Record<string, Array<[string, string]>> = {
    basketball_nba: [["trail", "blazers"]],
    baseball_mlb: [["red", "sox"], ["white", "sox"], ["blue", "jays"]],
    icehockey_nhl: [["golden", "knights"], ["blue", "jackets"], ["maple", "leafs"]],
    americanfootball_nfl: [],
  };

  const combos = sportKey ? twoWordNicknames[sportKey] || [] : [];
  if (secondLast && combos.some(([a, b]) => a === secondLast && b === last)) {
    return parts.slice(-2).join(" ");
  }

  // Default: use the last token (nickname)
  return parts[parts.length - 1];
}

/**
 * Determines game momentum based on scores and other factors
 * @param homeScore - Home team score
 * @param awayScore - Away team score
 * @param recentScoring - Optional recent scoring data
 * @returns Momentum indicator
 */
export function calculateMomentum(
  homeScore: number,
  awayScore: number,
  recentScoring?: { home: number; away: number }
): "home" | "away" | "neutral" {
  // If we have recent scoring data, use that
  if (recentScoring) {
    if (recentScoring.home > recentScoring.away) return "home";
    if (recentScoring.away > recentScoring.home) return "away";
  }
  
  // Fallback to current score differential
  const diff = Math.abs(homeScore - awayScore);
  if (diff <= 3) return "neutral"; // Close game
  
  return homeScore > awayScore ? "home" : "away";
}

/**
 * Formats game time display
 * @param startTime - Game start time
 * @param isLive - Whether the game is currently live
 * @returns Formatted time string
 */
export function formatGameTime(startTime: string | Date, isLive: boolean = false): string {
  const start = typeof startTime === 'string' ? new Date(startTime) : startTime;
  const now = new Date();
  
  if (isLive) {
    const minsAgo = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 60000));
    return minsAgo > 0 ? `LIVE ${minsAgo}m` : "LIVE";
  }
  
  return start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Calculates betting eligibility based on game state
 * @param startTime - Game start time
 * @param cutoffTime - Betting cutoff time
 * @returns Whether betting is allowed
 */
export function canPlaceBet(startTime: string | Date, cutoffTime?: string | Date): boolean {
  const now = new Date();
  const start = typeof startTime === 'string' ? new Date(startTime) : startTime;
  const cutoff = cutoffTime 
    ? (typeof cutoffTime === 'string' ? new Date(cutoffTime) : cutoffTime)
    : start; // Default cutoff is start time
  
  return now < cutoff;
}