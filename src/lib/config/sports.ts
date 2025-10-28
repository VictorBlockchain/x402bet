// Short <-> Odds API sport key mapping utilities
// Short keys align with contract slugs (e.g., "nba", "nfl")
// Odds API keys are used for external fetches and mock file names

export const SHORT_TO_ODDS_SPORT: Record<string, string> = {
  nba: 'basketball_nba',
  nfl: 'americanfootball_nfl',
  mlb: 'baseball_mlb',
  nhl: 'icehockey_nhl',
  epl: 'soccer_epl',
};

export const ODDS_TO_SHORT_SPORT: Record<string, string> = Object.fromEntries(
  Object.entries(SHORT_TO_ODDS_SPORT).map(([shortKey, oddsKey]) => [oddsKey, shortKey])
);

export function toOddsSportKey(shortKey: string): string {
  return SHORT_TO_ODDS_SPORT[shortKey] || shortKey;
}

export function toShortSportKey(oddsKey: string): string {
  return ODDS_TO_SHORT_SPORT[oddsKey] || oddsKey;
}