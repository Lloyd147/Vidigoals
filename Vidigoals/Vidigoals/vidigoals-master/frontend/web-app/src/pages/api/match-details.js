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
const CACHE_TTL_IDLE = 10 * 60 * 1000; // 10 minutes for finished matches
const CACHE_TTL_LIVE = 30 * 1000;      // 30 seconds for live matches

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
  if (cached) {
    const ttl = cached.isLive ? CACHE_TTL_LIVE : CACHE_TTL_IDLE;
    if (Date.now() - cached.fetchedAt < ttl) {
      return res.status(200).json(cached.data);
    }
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
          assists[side].push({ player: event.assist.name, minute: timeStr });
        }
      } else if (event.type === 'Card') {
        if (event.detail?.includes('Yellow')) {
          yellowCards[side].push({ player: playerName, minute: timeStr });
        } else if (event.detail?.includes('Red')) {
          redCards[side].push({ player: playerName, minute: timeStr });
        }
      }
    }

    // Group players with multiple entries: "O. Watkins (57', 73')" instead of listing twice
    function groupPlayers(entries) {
      const map = {};
      for (const e of entries) {
        if (!map[e.player]) map[e.player] = [];
        map[e.player].push(e.minute);
      }
      return Object.entries(map).map(([player, minutes]) => ({
        player,
        minute: minutes.join(', '),
      }));
    }

    const groupedGoals = { home: groupPlayers(goals.home), away: groupPlayers(goals.away) };
    const groupedAssists = { home: groupPlayers(assists.home), away: groupPlayers(assists.away) };
    const groupedYellowCards = { home: groupPlayers(yellowCards.home), away: groupPlayers(yellowCards.away) };
    const groupedRedCards = { home: groupPlayers(redCards.home), away: groupPlayers(redCards.away) };

    // ── Match Stats from API-Football ─────────────────────────────────────
    let matchStats = { home: {}, away: {} };
    let saves = { home: null, away: null };
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

    // Get goalkeeper names from lineups + full lineup data
    let lineups = { home: { startXI: [], subs: [], formation: '' }, away: { startXI: [], subs: [], formation: '' } };
    try {
      const lineupsData = await apiFetch(`/fixtures/lineups?fixture=${fixtureId}`);
      const lineupsResponse = lineupsData.response || [];
      for (const lineup of lineupsResponse) {
        const isHome = lineup.team?.id === homeTeam?.id;
        const side = isHome ? 'home' : 'away';

        // Get GK name for saves
        const gk = lineup.startXI?.find(p => p.player?.pos === 'G');
        const gkName = gk?.player?.name || 'Goalkeeper';
        const savesCount = matchStats[side]['Goalkeeper Saves'] || 0;
        saves[side] = { player: gkName, count: savesCount };

        // Store full lineup
        lineups[side] = {
          formation: lineup.formation || '',
          startXI: (lineup.startXI || []).map(p => ({
            name: p.player?.name,
            number: p.player?.number,
            pos: p.player?.pos,
          })),
          subs: (lineup.substitutes || []).map(p => ({
            name: p.player?.name,
            number: p.player?.number,
            pos: p.player?.pos,
          })),
        };
      }
    } catch {
      saves.home = { player: 'Goalkeeper', count: matchStats.home['Goalkeeper Saves'] || 0 };
      saves.away = { player: 'Goalkeeper', count: matchStats.away['Goalkeeper Saves'] || 0 };
    }

    // Format stats for display — use '—' only if stat is truly unavailable (null/undefined)
    // For live matches, 0 is a valid value and should show as 0
    const isLiveOrFinished = ['1H','2H','HT','ET','FT','AET','PEN'].includes(fixture.fixture?.status?.short);
    function statVal(val) {
      if (val === null || val === undefined) return isLiveOrFinished ? '0' : '—';
      return val;
    }

    const statsDisplay = [
      { label: 'Possession', home: statVal(matchStats.home['Ball Possession']), away: statVal(matchStats.away['Ball Possession']) },
      { label: 'Expected Goals (xG)', home: statVal(matchStats.home['expected_goals'] ?? matchStats.home['Expected Goals']), away: statVal(matchStats.away['expected_goals'] ?? matchStats.away['Expected Goals']) },
      { label: 'Total Shots', home: statVal(matchStats.home['Total Shots']), away: statVal(matchStats.away['Total Shots']) },
      { label: 'Shots on Target', home: statVal(matchStats.home['Shots on Goal']), away: statVal(matchStats.away['Shots on Goal']) },
      { label: 'Shots off Target', home: statVal(matchStats.home['Shots off Goal']), away: statVal(matchStats.away['Shots off Goal']) },
      { label: 'Corners', home: statVal(matchStats.home['Corner Kicks']), away: statVal(matchStats.away['Corner Kicks']) },
      { label: 'Fouls', home: statVal(matchStats.home['Fouls']), away: statVal(matchStats.away['Fouls']) },
      { label: 'Offsides', home: statVal(matchStats.home['Offsides']), away: statVal(matchStats.away['Offsides']) },
      { label: 'Goalkeeper Saves', home: statVal(matchStats.home['Goalkeeper Saves']), away: statVal(matchStats.away['Goalkeeper Saves']) },
      { label: 'Passes', home: statVal(matchStats.home['Total passes']), away: statVal(matchStats.away['Total passes']) },
      { label: 'Pass Accuracy', home: statVal(matchStats.home['Passes %']), away: statVal(matchStats.away['Passes %']) },
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
      goals: groupedGoals,
      assists: groupedAssists,
      yellowCards: groupedYellowCards,
      redCards: groupedRedCards,
      saves,
      lineups,
      bonus,
      stats: statsDisplay,
    };

    // Determine if match is live
    const liveStatuses = ['1H', '2H', 'HT', 'ET', 'P', 'BT'];
    const isLive = liveStatuses.includes(fixture.fixture?.status?.short);

    detailsCache.set(fixtureId, { data: result, fetchedAt: Date.now(), isLive });
    return res.status(200).json(result);
  } catch (err) {
    console.error('Match details error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
