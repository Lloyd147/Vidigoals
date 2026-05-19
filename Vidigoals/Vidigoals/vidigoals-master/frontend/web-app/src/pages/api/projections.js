/**
 * API Route: /api/projections
 *
 * Calculates the best projected starting 11 from ALL Premier League players
 * for the next GW. Same result for every user.
 *
 * Uses: FPL ep_next, fixture difficulty, odds data, chance of playing.
 * Picks best valid formation (1 GK, 3-5 DEF, 2-5 MID, 1-3 FWD) = 11 players.
 */

let projectionsCache = { data: null, fetchedAt: 0 };
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes (same for all users)

async function fplFetch(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VidiGoals/1.0)' },
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  // Same for all users — single cache
  if (projectionsCache.data && Date.now() - projectionsCache.fetchedAt < CACHE_TTL) {
    return res.status(200).json(projectionsCache.data);
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
    for (const t of teams) teamMap[t.id] = t;

    // Build fixture difficulty map: teamId → { opponent, difficulty, isHome }
    const fixtureDiffMap = {};
    for (const fix of nextFixtures) {
      fixtureDiffMap[fix.team_h] = { opponent: teamMap[fix.team_a]?.short_name || '', difficulty: fix.team_h_difficulty || 3, isHome: true };
      fixtureDiffMap[fix.team_a] = { opponent: teamMap[fix.team_h]?.short_name || '', difficulty: fix.team_a_difficulty || 3, isHome: false };
    }

    // Get odds data
    let oddsData = null;
    try {
      const oddsRes = await fetch(`${req.headers.origin || 'http://localhost:3000'}/api/livescore-odds`);
      if (oddsRes.ok) { const od = await oddsRes.json(); oddsData = od.odds || null; }
    } catch {}

    // Calculate projections for ALL players
    const posMap = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };
    const projections = [];

    for (const player of players) {
      const team = teamMap[player.team] || {};
      const fixture = fixtureDiffMap[player.team] || null;

      // Skip players without a fixture this GW
      if (!fixture) continue;

      // Skip players unlikely to play
      const chanceOfPlaying = player.chance_of_playing_next_round;
      if (player.status === 'i' || player.status === 'u') continue;
      if (chanceOfPlaying !== null && chanceOfPlaying < 50) continue;

      // Base projection: FPL's own expected points
      let baseProjection = parseFloat(player.ep_next) || 0;
      if (baseProjection === 0 && player.form) baseProjection = parseFloat(player.form) || 0;
      if (baseProjection <= 0) continue; // Skip players with no expected output

      // Fixture difficulty adjustment
      let fdrMultiplier = 1.0;
      if (fixture.difficulty <= 2) fdrMultiplier = 1.15;
      else if (fixture.difficulty === 4) fdrMultiplier = 0.85;
      else if (fixture.difficulty >= 5) fdrMultiplier = 0.7;
      if (fixture.isHome) fdrMultiplier *= 1.05;

      // Playing probability
      let playingMult = 1.0;
      if (chanceOfPlaying !== null && chanceOfPlaying < 100) playingMult = chanceOfPlaying / 100;
      if (player.status === 'd') playingMult = Math.min(playingMult, 0.6);

      // Odds boost
      let oddsBoost = 0;
      if (oddsData) {
        const webName = (player.web_name || '').toLowerCase();
        const oddsEntry = Object.values(oddsData).find(o => {
          const oddsName = (o.name || '').toLowerCase();
          return oddsName.includes(webName) || webName.includes(oddsName.split(' ').pop());
        });
        if (oddsEntry) {
          if (oddsEntry.anytime?.odds) {
            const prob = 1 / parseFloat(oddsEntry.anytime.odds);
            const goalPts = player.element_type <= 2 ? 6 : player.element_type === 3 ? 5 : 4;
            oddsBoost += prob * goalPts;
          }
          if (oddsEntry.assists?.odds) {
            oddsBoost += (1 / parseFloat(oddsEntry.assists.odds)) * 3;
          }
        }
      }

      const projectedPoints = Math.round(((baseProjection * fdrMultiplier) + oddsBoost) * playingMult * 10) / 10;

      projections.push({
        id: player.id,
        name: player.web_name,
        fullName: `${player.first_name} ${player.second_name}`,
        position: player.element_type,
        posLabel: posMap[player.element_type] || '',
        team: team.name || '',
        teamShort: team.short_name || '',
        teamId: player.team,
        fixture: `${fixture.opponent} (${fixture.isHome ? 'H' : 'A'})`,
        difficulty: fixture.difficulty,
        projectedPoints,
        epNext: parseFloat(player.ep_next) || 0,
        form: parseFloat(player.form) || 0,
        price: (player.now_cost / 10).toFixed(1),
      });
    }

    // Sort all by projected points
    projections.sort((a, b) => b.projectedPoints - a.projectedPoints);

    // Pick best valid starting 11 from ALL players
    const bestXI = pickBestXI(projections);
    const totalProjected = Math.round(bestXI.reduce((sum, p) => sum + p.projectedPoints, 0) * 10) / 10;

    const result = {
      gameweek: nextGWId,
      totalProjected,
      starting: bestXI,
    };

    projectionsCache = { data: result, fetchedAt: Date.now() };
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// Pick best valid starting 11 from all players
function pickBestXI(players) {
  const sorted = [...players].sort((a, b) => b.projectedPoints - a.projectedPoints);
  const gks = sorted.filter(p => p.position === 1);
  const defs = sorted.filter(p => p.position === 2);
  const mids = sorted.filter(p => p.position === 3);
  const fwds = sorted.filter(p => p.position === 4);

  // Try formations: 3-5-2, 3-4-3, 4-4-2, 4-3-3, 4-5-1, 5-4-1, 5-3-2
  const formations = [
    [3, 5, 2], [3, 4, 3], [4, 4, 2], [4, 3, 3], [4, 5, 1], [5, 4, 1], [5, 3, 2],
  ];

  let bestTeam = null;
  let bestTotal = 0;

  for (const [d, m, f] of formations) {
    if (defs.length < d || mids.length < m || fwds.length < f || gks.length < 1) continue;
    const team = [gks[0], ...defs.slice(0, d), ...mids.slice(0, m), ...fwds.slice(0, f)];
    const total = team.reduce((sum, p) => sum + p.projectedPoints, 0);
    if (total > bestTotal) {
      bestTotal = total;
      bestTeam = team;
    }
  }

  return bestTeam || sorted.slice(0, 11);
}
