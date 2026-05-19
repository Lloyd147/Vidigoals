/**
 * API Route: /api/leagues
 *
 * Fetches league data from FPL API.
 *
 * GET ?id={managerId} — returns all leagues the manager is in
 * GET ?leagueId={id}&gw={gameweek} — returns standings for a specific league
 * GET ?leagueId={id}&page={page} — paginated standings
 */

const leagueCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fplFetch(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VidiGoals/1.0)' },
  });
  if (!res.ok) throw new Error(`FPL API error: ${res.status}`);
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const { id, leagueId, gw, page } = req.query;

  try {
    // Mode 1: Get all leagues for a manager
    if (id && !leagueId) {
      const cacheKey = `manager-${id}`;
      const cached = leagueCache.get(cacheKey);
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
        return res.status(200).json(cached.data);
      }

      const entry = await fplFetch(`https://fantasy.premierleague.com/api/entry/${id}/`);
      const leagues = entry.leagues || {};

      const result = {
        classic: (leagues.classic || []).map(l => ({
          id: l.id,
          name: l.name,
          rank: l.entry_rank,
          lastRank: l.entry_last_rank,
          type: 'classic',
        })),
        h2h: (leagues.h2h || []).map(l => ({
          id: l.id,
          name: l.name,
          rank: l.entry_rank,
          lastRank: l.entry_last_rank,
          type: 'h2h',
        })),
        cup: leagues.cup || {},
      };

      leagueCache.set(cacheKey, { data: result, fetchedAt: Date.now() });
      return res.status(200).json(result);
    }

    // Mode 2: Get standings for a specific league
    if (leagueId) {
      const pageNum = page || 1;
      const leagueType = req.query.type || 'classic'; // 'classic' or 'h2h'
      const cacheKey = `league-${leagueId}-${leagueType}-${pageNum}`;
      const cached = leagueCache.get(cacheKey);
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
        return res.status(200).json(cached.data);
      }

      // H2H leagues use a different endpoint
      if (leagueType === 'h2h') {
        const data = await fplFetch(`https://fantasy.premierleague.com/api/leagues-h2h/${leagueId}/standings/?page_standings=${pageNum}`);
        const league = data.league || {};
        const standings = data.standings || {};
        // Also fetch matches for current GW
        let matches = [];
        try {
          const matchData = await fplFetch(`https://fantasy.premierleague.com/api/leagues-h2h-matches/league/${leagueId}/?page=1`);
          matches = (matchData.results || []).map(m => ({
            event: m.event,
            player1: { entry: m.entry_1_entry, name: m.entry_1_player_name, teamName: m.entry_1_name, points: m.entry_1_points },
            player2: { entry: m.entry_2_entry, name: m.entry_2_player_name, teamName: m.entry_2_name, points: m.entry_2_points },
          }));
        } catch {}

        const result = {
          league: { id: league.id, name: league.name },
          standings: (standings.results || []).map(s => ({
            rank: s.rank,
            entry: s.entry,
            entryName: s.entry_name,
            playerName: s.player_name,
            total: s.total,
            eventTotal: s.points_for || 0,
            wins: s.matches_won || 0,
            draws: s.matches_drawn || 0,
            losses: s.matches_lost || 0,
          })),
          matches,
          hasNext: standings.has_next || false,
          page: Number(pageNum),
          type: 'h2h',
        };

        leagueCache.set(cacheKey, { data: result, fetchedAt: Date.now() });
        return res.status(200).json(result);
      }

      // Classic league

      const data = await fplFetch(`https://fantasy.premierleague.com/api/leagues-classic/${leagueId}/standings/?page_standings=${pageNum}`);
      const league = data.league || {};
      const standings = data.standings || {};

      const result = {
        league: {
          id: league.id,
          name: league.name,
          created: league.created,
        },
        standings: (standings.results || []).map(s => ({
          rank: s.rank,
          lastRank: s.last_rank,
          entry: s.entry,
          entryName: s.entry_name,
          playerName: s.player_name,
          total: s.total,
          eventTotal: s.event_total,
        })),
        hasNext: standings.has_next || false,
        page: Number(pageNum),
        type: 'classic',
      };

      leagueCache.set(cacheKey, { data: result, fetchedAt: Date.now() });
      return res.status(200).json(result);
    }

    return res.status(400).json({ error: 'id or leagueId required' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
