/**
 * API Route: /api/match-details?fixtureId={id}&fplFixtureId={fplId}
 *
 * Returns:
 * - Match Details: goals, assists, cards, saves, bonus (from FPL)
 * - Match Stats: possession, shots, xG, corners, fouls etc (from API-Football)
 */

const API_KEY = process.env.API_FOOTBALL_KEY;
const BASE_URL = 'https://v3.football.api-sports.io';

const detailsCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

async function apiFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'x-apisports-key': API_KEY },
  });
  if (!res.ok) throw new Error(`API-Football error: ${res.status}`);
  return res.json();
}

async function fplFetch(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VidiGoals/1.0)' },
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!API_KEY) return res.status(500).json({ error: 'API key not configured' });

  const { fixtureId } = req.query;
  if (!fixtureId) return res.status(400).json({ error: 'fixtureId required' });

  // Check cache
  const cached = detailsCache.get(fixtureId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return res.status(200).json(cached.data);
  }

  try {
    // Fetch full fixture with events
    const fixtureData = await apiFetch(`/fixtures?id=${fixtureId}`);
    const fixture = fixtureData.response?.[0];
    if (!fixture) return res.status(404).json({ error: 'Fixture not found' });

    const events = fixture.events || [];
    const homeTeam = fixture.teams?.home;
    const awayTeam = fixture.teams?.away;

    // ── Match Details ─────────────────────────────────────────────────────
    const goals = { home: [], away: [] };
    const assists = { home: [], away: [] };
    const yellowCards = { home: [], away: [] };
    const redCards = { home: [], away: [] };

    for (const event of events) {
      const isHome = event.team?.id === homeTeam?.id;
      const side = isHome ? 'home' : 'away';
      const playerName = event.player?.name || 'Unknown';
      const minute = event.time?.elapsed;
      const extra = event.time?.extra;
      const timeStr = extra ? `${minute}+${extra}'` : `${minute}'`;

      if (event.type === 'Goal' && event.detail !== 'Missed Penalty') {
        goals[side].push({ player: playerName, minute: timeStr });
        if (event.assist?.name) {
          assists[side].push({ player: event.assist.name });
        }
      } else if (event.type === 'Card') {
        if (event.detail?.includes('Yellow')) {
          yellowCards[side].push({ player: playerName });
        } else if (event.detail?.includes('Red')) {
          redCards[side].push({ player: playerName });
        }
      }
    }

    // ── Match Stats from API-Football ─────────────────────────────────────
    let matchStats = { home: {}, away: {} };
    try {
      const statsData = await apiFetch(`/fixtures/statistics?fixture=${fixtureId}`);
      const stats = statsData.response || [];
      for (const teamStats of stats) {
        const isHome = teamStats.team?.id === homeTeam?.id;
        const side = isHome ? 'home' : 'away';
        const statMap = {};
        for (const s of (teamStats.statistics || [])) {
          statMap[s.type] = s.value;
        }
        matchStats[side] = statMap;
      }
    } catch {}

    // Format stats for display
    const statsDisplay = [
      { label: 'Possession', home: matchStats.home['Ball Possession'] || '—', away: matchStats.away['Ball Possession'] || '—' },
      { label: 'Expected Goals (xG)', home: matchStats.home['expected_goals'] || matchStats.home['Expected Goals'] || '—', away: matchStats.away['expected_goals'] || matchStats.away['Expected Goals'] || '—' },
      { label: 'Total Shots', home: matchStats.home['Total Shots'] || '—', away: matchStats.away['Total Shots'] || '—' },
      { label: 'Shots on Target', home: matchStats.home['Shots on Goal'] || '—', away: matchStats.away['Shots on Goal'] || '—' },
      { label: 'Shots off Target', home: matchStats.home['Shots off Goal'] || '—', away: matchStats.away['Shots off Goal'] || '—' },
      { label: 'Corners', home: matchStats.home['Corner Kicks'] || '—', away: matchStats.away['Corner Kicks'] || '—' },
      { label: 'Fouls', home: matchStats.home['Fouls'] || '—', away: matchStats.away['Fouls'] || '—' },
      { label: 'Offsides', home: matchStats.home['Offsides'] || '—', away: matchStats.away['Offsides'] || '—' },
      { label: 'Goalkeeper Saves', home: matchStats.home['Goalkeeper Saves'] || '—', away: matchStats.away['Goalkeeper Saves'] || '—' },
      { label: 'Passes', home: matchStats.home['Total passes'] || '—', away: matchStats.away['Total passes'] || '—' },
      { label: 'Pass Accuracy', home: matchStats.home['Passes %'] || '—', away: matchStats.away['Passes %'] || '—' },
    ];

    // ── Bonus Points from FPL ─────────────────────────────────────────────
    let bonus = { home: [], away: [] };
    try {
      // FPL fixtures endpoint — find matching fixture by team IDs
      const fplFixtures = await fplFetch('https://fantasy.premierleague.com/api/fixtures/');
      if (fplFixtures) {
        // Get FPL bootstrap for team mapping
        const bootstrap = await fplFetch('https://fantasy.premierleague.com/api/bootstrap-static/');
        if (bootstrap) {
          // Map API-Football team names to FPL team IDs
          const fplTeams = bootstrap.teams || [];
          const homeNameLower = homeTeam?.name?.toLowerCase() || '';
          const awayNameLower = awayTeam?.name?.toLowerCase() || '';

          const fplHome = fplTeams.find(t =>
            homeNameLower.includes(t.short_name?.toLowerCase()) ||
            t.name?.toLowerCase().includes(homeNameLower.split(' ')[0])
          );
          const fplAway = fplTeams.find(t =>
            awayNameLower.includes(t.short_name?.toLowerCase()) ||
            t.name?.toLowerCase().includes(awayNameLower.split(' ')[0])
          );

          if (fplHome && fplAway) {
            // Find the FPL fixture
            const fplFixture = fplFixtures.find(f =>
              f.team_h === fplHome.id && f.team_a === fplAway.id && f.finished
            );

            if (fplFixture?.stats) {
              const bonusStat = fplFixture.stats.find(s => s.identifier === 'bonus');
              if (bonusStat) {
                const playerMap = {};
                for (const p of bootstrap.elements || []) {
                  playerMap[p.id] = p;
                }

                for (const entry of (bonusStat.h || [])) {
                  const player = playerMap[entry.element];
                  if (player) {
                    bonus.home.push({ player: player.web_name, value: entry.value });
                  }
                }
                for (const entry of (bonusStat.a || [])) {
                  const player = playerMap[entry.element];
                  if (player) {
                    bonus.away.push({ player: player.web_name, value: entry.value });
                  }
                }
              }
            }
          }
        }
      }
    } catch {}

    const result = {
      home: homeTeam?.name,
      away: awayTeam?.name,
      homeLogo: homeTeam?.logo,
      awayLogo: awayTeam?.logo,
      score: `${fixture.goals?.home ?? 0} - ${fixture.goals?.away ?? 0}`,
      goals,
      assists,
      yellowCards,
      redCards,
      saves: {
        home: matchStats.home['Goalkeeper Saves'] || 0,
        away: matchStats.away['Goalkeeper Saves'] || 0,
      },
      bonus,
      stats: statsDisplay,
    };

    detailsCache.set(fixtureId, { data: result, fetchedAt: Date.now() });
    return res.status(200).json(result);
  } catch (err) {
    console.error('Match details error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
