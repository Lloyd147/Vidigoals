/**
 * API Route: /api/projections?id={managerId}
 *
 * Calculates projected points for a manager's squad for the next GW.
 * Uses: FPL ep_next, fixture difficulty, odds data, chance of playing.
 *
 * Returns: best starting 11 + bench with projected points per player.
 */

let projectionsCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function fplFetch(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VidiGoals/1.0)' },
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });

  const cacheKey = `proj-${id}`;
  const cached = projectionsCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return res.status(200).json(cached.data);
  }

  try {
    const bootstrap = await fplFetch('https://fantasy.premierleague.com/api/bootstrap-static/');
    if (!bootstrap) return res.status(500).json({ error: 'Could not fetch FPL data' });

    const players = bootstrap.elements || [];
    const teams = bootstrap.teams || [];
    const events = bootstrap.events || [];

    // Find next GW
    const nextGW = events.find(e => e.is_next) || events.find(e => e.is_current) || events[events.length - 1];
    const nextGWId = nextGW?.id || 38;

    // Get fixtures for next GW
    const allFixtures = await fplFetch('https://fantasy.premierleague.com/api/fixtures/');
    const nextFixtures = (allFixtures || []).filter(f => f.event === nextGWId);

    // Build team lookup
    const teamMap = {};
    for (const t of teams) {
      teamMap[t.id] = t;
    }

    // Build fixture difficulty map: teamId → { opponent, difficulty, isHome }
    const fixtureDiffMap = {};
    for (const fix of nextFixtures) {
      fixtureDiffMap[fix.team_h] = {
        opponent: teamMap[fix.team_a]?.short_name || '',
        difficulty: fix.team_h_difficulty || 3,
        isHome: true,
        opponentId: fix.team_a,
      };
      fixtureDiffMap[fix.team_a] = {
        opponent: teamMap[fix.team_h]?.short_name || '',
        difficulty: fix.team_a_difficulty || 3,
        isHome: false,
        opponentId: fix.team_h,
      };
    }

    // Get manager's current squad
    const picksData = await fplFetch(`https://fantasy.premierleague.com/api/entry/${id}/event/${nextGWId}/picks/`);
    let squadIds = [];
    if (picksData?.picks) {
      squadIds = picksData.picks.map(p => p.element);
    } else {
      // Try previous GW
      const prevPicks = await fplFetch(`https://fantasy.premierleague.com/api/entry/${id}/event/${nextGWId - 1}/picks/`);
      if (prevPicks?.picks) {
        squadIds = prevPicks.picks.map(p => p.element);
      }
    }

    if (squadIds.length === 0) {
      return res.status(404).json({ error: 'Could not load squad' });
    }

    // Get odds data (try to fetch, non-blocking)
    let oddsData = null;
    try {
      const oddsRes = await fetch(`${req.headers.origin || 'http://localhost:3000'}/api/livescore-odds`);
      if (oddsRes.ok) {
        const od = await oddsRes.json();
        oddsData = od.odds || null;
      }
    } catch {}

    // Calculate projections for each squad player
    const posMap = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };
    const projections = [];

    for (const playerId of squadIds) {
      const player = players.find(p => p.id === playerId);
      if (!player) continue;

      const team = teamMap[player.team] || {};
      const fixture = fixtureDiffMap[player.team] || null;
      const chanceOfPlaying = player.chance_of_playing_next_round;

      // Base projection: FPL's own expected points
      let baseProjection = parseFloat(player.ep_next) || 0;

      // If no ep_next, estimate from form
      if (baseProjection === 0 && player.form) {
        baseProjection = parseFloat(player.form) || 2;
      }

      // Fixture difficulty adjustment
      // FDR 1-2 = easy (boost), 3 = neutral, 4-5 = hard (reduce)
      let fdrMultiplier = 1.0;
      if (fixture) {
        if (fixture.difficulty <= 2) fdrMultiplier = 1.15; // Easy fixture boost
        else if (fixture.difficulty === 3) fdrMultiplier = 1.0;
        else if (fixture.difficulty === 4) fdrMultiplier = 0.85;
        else if (fixture.difficulty >= 5) fdrMultiplier = 0.7;

        // Home advantage slight boost
        if (fixture.isHome) fdrMultiplier *= 1.05;
      }

      // Chance of playing adjustment
      let playingMultiplier = 1.0;
      if (chanceOfPlaying !== null && chanceOfPlaying !== undefined) {
        playingMultiplier = chanceOfPlaying / 100;
      }
      // If status is injured/unavailable and no chance given, assume low
      if (player.status === 'i' || player.status === 'u') {
        playingMultiplier = Math.min(playingMultiplier, 0.1);
      } else if (player.status === 'd') {
        playingMultiplier = Math.min(playingMultiplier, 0.5);
      }

      // Odds boost: if we have anytime goalscorer odds, lower odds = higher chance
      let oddsBoost = 0;
      if (oddsData) {
        const webName = (player.web_name || '').toLowerCase();
        const oddsEntry = Object.values(oddsData).find(o => {
          const oddsName = (o.name || '').toLowerCase();
          return oddsName.includes(webName) || webName.includes(oddsName.split(' ').pop());
        });
        if (oddsEntry) {
          // Anytime goalscorer odds → implied probability → bonus points
          if (oddsEntry.anytime?.odds) {
            const impliedProb = 1 / parseFloat(oddsEntry.anytime.odds);
            // GK/DEF goal = 6pts, MID = 5, FWD = 4
            const goalPts = player.element_type <= 2 ? 6 : player.element_type === 3 ? 5 : 4;
            oddsBoost += impliedProb * goalPts;
          }
          // Assist odds
          if (oddsEntry.assists?.odds) {
            const assistProb = 1 / parseFloat(oddsEntry.assists.odds);
            oddsBoost += assistProb * 3; // 3 pts for assist
          }
        }
      }

      // Final projection
      const projectedPoints = Math.round(((baseProjection * fdrMultiplier) + oddsBoost) * playingMultiplier * 10) / 10;

      projections.push({
        id: player.id,
        name: player.web_name,
        fullName: `${player.first_name} ${player.second_name}`,
        position: player.element_type,
        posLabel: posMap[player.element_type] || '',
        team: team.name || '',
        teamShort: team.short_name || '',
        teamId: player.team,
        fixture: fixture ? `${fixture.opponent} (${fixture.isHome ? 'H' : 'A'})` : '—',
        difficulty: fixture?.difficulty || 3,
        projectedPoints,
        epNext: parseFloat(player.ep_next) || 0,
        form: parseFloat(player.form) || 0,
        chanceOfPlaying,
        status: player.status,
      });
    }

    // Sort by projected points descending
    projections.sort((a, b) => b.projectedPoints - a.projectedPoints);

    // Pick best starting 11 (must have valid formation: 1 GK, 3-5 DEF, 2-5 MID, 1-3 FWD)
    const bestXI = pickBestXI(projections);
    const bench = projections.filter(p => !bestXI.includes(p));

    // Total projected points
    const totalProjected = Math.round(bestXI.reduce((sum, p) => sum + p.projectedPoints, 0) * 10) / 10;

    const result = {
      gameweek: nextGWId,
      totalProjected,
      starting: bestXI,
      bench,
    };

    projectionsCache.set(cacheKey, { data: result, fetchedAt: Date.now() });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// Pick best valid starting 11 from squad
function pickBestXI(players) {
  // Sort by projected points desc
  const sorted = [...players].sort((a, b) => b.projectedPoints - a.projectedPoints);

  const gks = sorted.filter(p => p.position === 1);
  const defs = sorted.filter(p => p.position === 2);
  const mids = sorted.filter(p => p.position === 3);
  const fwds = sorted.filter(p => p.position === 4);

  // Must have: 1 GK, at least 3 DEF, at least 2 MID, at least 1 FWD
  // Total = 11
  const xi = [];

  // Pick best GK
  if (gks.length > 0) xi.push(gks[0]);

  // Start with minimum: 3 DEF, 2 MID, 1 FWD = 6 outfield + 1 GK = 7
  // Need 4 more from remaining players (sorted by projection)
  const minDef = defs.slice(0, 3);
  const minMid = mids.slice(0, 2);
  const minFwd = fwds.slice(0, 1);

  xi.push(...minDef, ...minMid, ...minFwd);

  // Fill remaining 4 spots from best available (respecting max: 5 DEF, 5 MID, 3 FWD)
  const remaining = sorted.filter(p => !xi.includes(p) && p.position !== 1);
  const defCount = xi.filter(p => p.position === 2).length;
  const midCount = xi.filter(p => p.position === 3).length;
  const fwdCount = xi.filter(p => p.position === 4).length;

  let spotsLeft = 11 - xi.length;
  for (const p of remaining) {
    if (spotsLeft <= 0) break;
    const currentDef = xi.filter(x => x.position === 2).length;
    const currentMid = xi.filter(x => x.position === 3).length;
    const currentFwd = xi.filter(x => x.position === 4).length;

    if (p.position === 2 && currentDef >= 5) continue;
    if (p.position === 3 && currentMid >= 5) continue;
    if (p.position === 4 && currentFwd >= 3) continue;

    xi.push(p);
    spotsLeft--;
  }

  return xi;
}
