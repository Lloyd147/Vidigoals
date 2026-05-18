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

    // Get manager's picks for this GW (fall back to previous GW if 404)
    let picksData = null;
    let actualGW = currentGW;
    try {
      picksData = await fplFetch(`https://fantasy.premierleague.com/api/entry/${id}/event/${currentGW}/picks/`);
    } catch {
      // GW not available yet (404) — fall back to previous GW's picks
      if (Number(currentGW) > 1) {
        actualGW = Number(currentGW) - 1;
        picksData = await fplFetch(`https://fantasy.premierleague.com/api/entry/${id}/event/${actualGW}/picks/`);
      }
    }
    if (!picksData) {
      return res.status(404).json({ error: 'Could not load picks' });
    }

    // Build player lookup map
    const playerMap = {};
    for (const p of bootstrap.elements || []) {
      playerMap[p.id] = p;
    }
    const teamMap = {};
    for (const t of bootstrap.teams || []) {
      teamMap[t.id] = t;
    }

    // Find the actual current/latest GW for navigation bounds
    const latestGW = bootstrap.events?.find(e => e.is_current)?.id
      || bootstrap.events?.filter(e => e.finished).pop()?.id
      || 38;

    // Position names
    const posMap = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };

    // Get GW-specific player points from the live endpoint
    let gwPoints = {};
    let gwGoals = {};
    let gwCards = {};
    let gwAssists = {};
    let gwFixtureFinished = {};
    try {
      const liveData = await fplFetch(`https://fantasy.premierleague.com/api/event/${currentGW}/live/`);
      if (liveData?.elements) {
        for (const el of liveData.elements) {
          gwPoints[el.id] = el.stats?.total_points ?? 0;
          gwGoals[el.id] = el.stats?.goals_scored ?? 0;
          gwCards[el.id] = { yellow: el.stats?.yellow_cards ?? 0, red: el.stats?.red_cards ?? 0 };
          gwAssists[el.id] = el.stats?.assists ?? 0;
        }
      }
    } catch {}

    // Enrich picks with player data
    // Get fixtures for the REQUESTED GW (not the fallback GW)
    let gwFixtures = [];
    try {
      // Always fetch all fixtures and filter — most reliable method
      const allFixtures = await fplFetch('https://fantasy.premierleague.com/api/fixtures/');
      if (allFixtures && Array.isArray(allFixtures)) {
        gwFixtures = allFixtures.filter(f => f.event == currentGW);
      }
    } catch {}

    const picks = (picksData.picks || []).map(pick => {
      const player = playerMap[pick.element] || {};
      const team = teamMap[player.team] || {};
      // Use GW-specific points if available; if this is a future GW (fallback), show 0
      const isFutureGW = Number(actualGW) !== Number(currentGW);
      const eventPts = isFutureGW ? 0 : (gwPoints[pick.element] ?? player.event_points ?? 0);

      // Find this player's fixture in the GW
      let fixture = null;
      let opponent = null;
      let isHome = false;
      let fixtureFinished = false;
      let fixtureLive = false;
      let fixtureMinutes = null;
      const playerTeamId = player.team;
      if (playerTeamId && gwFixtures.length > 0) {
        const fix = gwFixtures.find(f => f.team_h === playerTeamId || f.team_a === playerTeamId);
        if (fix) {
          isHome = fix.team_h === playerTeamId;
          const oppTeamId = isHome ? fix.team_a : fix.team_h;
          const oppTeam = teamMap[oppTeamId] || {};
          opponent = oppTeam.short_name || '';
          fixture = `${opponent} (${isHome ? 'H' : 'A'})`;
          fixtureFinished = fix.finished || fix.finished_provisional || false;
          fixtureLive = fix.started && !fix.finished && !fix.finished_provisional;
          fixtureMinutes = fix.minutes || null;
        }
      }

      const goalsScored = isFutureGW ? 0 : (gwGoals[pick.element] || 0);
      const yellowCards = isFutureGW ? 0 : (gwCards[pick.element]?.yellow || 0);
      const redCards = isFutureGW ? 0 : (gwCards[pick.element]?.red || 0);
      const assistsMade = isFutureGW ? 0 : (gwAssists[pick.element] || 0);

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
        team_id: player.team || null,
        fixture,
        opponent,
        isHome,
        fixtureFinished,
        fixtureLive,
        fixtureMinutes,
        goalsScored,
        yellowCards,
        redCards,
        assistsMade,
        event_points: eventPts,
        total_points: player.total_points ?? 0,
        photo: player.photo ? player.photo.replace('.jpg', '.png') : null,
      };
    });

    // Split into starting XI and bench
    const starting = picks.filter(p => p.position <= 11);
    const bench = picks.filter(p => p.position > 11);

    const result = {
      gameweek: Number(currentGW),
      latestGW,
      active_chip: (Number(actualGW) !== Number(currentGW)) ? null : picksData.active_chip,
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
