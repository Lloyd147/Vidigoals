/**
 * API Route: /api/fpl-picks?id={managerId}&gw={gameweek}
 *
 * Fetches a manager's picks for a given gameweek from the public FPL API.
 * Also fetches player data to get names, team, position and points.
 */

const picksCache = new Map();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

async function fplFetch(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VidiGoals/1.0)' },
  });
  if (!res.ok) throw new Error(`FPL API error: ${res.status}`);
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id, gw } = req.query;
  if (!id || isNaN(id)) return res.status(400).json({ error: 'Invalid Manager ID' });

  const cacheKey = `${id}-${gw || 'current'}`;
  const cached = picksCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return res.status(200).json(cached.data);
  }

  try {
    // Get bootstrap data (all players, teams, current GW)
    const bootstrap = await fplFetch('https://fantasy.premierleague.com/api/bootstrap-static/');
    const currentGW = gw || bootstrap.events?.find(e => e.is_current)?.id || bootstrap.events?.find(e => e.is_next)?.id || 38;

    // Get manager's picks for this GW
    const picksData = await fplFetch(`https://fantasy.premierleague.com/api/entry/${id}/event/${currentGW}/picks/`);

    // Build player lookup map
    const playerMap = {};
    for (const p of bootstrap.elements || []) {
      playerMap[p.id] = p;
    }
    const teamMap = {};
    for (const t of bootstrap.teams || []) {
      teamMap[t.id] = t;
    }

    // Position names
    const posMap = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };

    // Enrich picks with player data
    const picks = (picksData.picks || []).map(pick => {
      const player = playerMap[pick.element] || {};
      const team = teamMap[player.team] || {};
      return {
        element: pick.element,
        position: pick.position,
        multiplier: pick.multiplier,
        is_captain: pick.is_captain,
        is_vice_captain: pick.is_vice_captain,
        name: `${player.first_name} ${player.second_name}`,
        web_name: player.web_name,
        element_type: player.element_type,
        pos_label: posMap[player.element_type] || '',
        team_name: team.name || '',
        team_short: team.short_name || '',
        event_points: player.event_points ?? 0,
        total_points: player.total_points ?? 0,
        photo: player.photo ? player.photo.replace('.jpg', '.png') : null,
      };
    });

    // Split into starting XI and bench
    const starting = picks.filter(p => p.position <= 11);
    const bench = picks.filter(p => p.position > 11);

    const result = {
      gameweek: currentGW,
      active_chip: picksData.active_chip,
      entry_history: picksData.entry_history,
      starting,
      bench,
    };

    picksCache.set(cacheKey, { data: result, fetchedAt: Date.now() });
    return res.status(200).json(result);
  } catch (err) {
    console.error('FPL picks error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
