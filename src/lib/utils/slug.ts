export function slugifySegment(input: string): string {
  const s = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s/g, '-')
    .replace(/[^a-z0-9-]/g, '')
  // Collapse multiple hyphens
  return s.replace(/-+/g, '-')
}

export function buildSlug(sport: string, region: string, proposition: string, home: string, away: string): string {
  return [sport, region, proposition, home, away]
    .map(slugifySegment)
    .join(':')
}

export function parseHomeAway(homeVsAway: string): { home: string; away: string } {
  const hva = String(homeVsAway || '')
  const [homeRaw, awayRaw] = hva.split(':')
  return {
    home: homeRaw || '',
    away: awayRaw || '',
  }
}