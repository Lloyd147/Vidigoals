/**
 * API Route: /api/match-details?fixtureId={id}&fplFixtureId={fplId}
 *
 * Returns:
 * - Match Details: goals, assists, cards, saves, bonus (from FPL)
 * - Match Stats: possession, shots, xG, corners, fouls etc (from API-Football)
 */

const API_KEY = process.env.API_FOOTBALL_KEY;
const BASE_URL = 'https://v3.football.api-sports.io';

// Import assist tracker for reconciled assists during live matches
let assistTracker = null;
try {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    assistTracker = require('../../lib/assist-tracker');
  }
} catch {}

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

    // ── Apply reconciled assists from Redis during live matches ──────────────
    const liveStatuses2 = ['1H', '2H', 'HT', 'ET', 'P', 'BT'];
    const isCurrentlyLive = liveStatuses2.includes(fixture.fixture?.status?.short);
    if (isCurrentlyLive) {
      let foundReconciled = false;

      // Try Redis first
      if (assistTracker) {
        try {
          const assistMap = await assistTracker.getFixtureAssists(fixtureId);
          if (assistMap && Object.keys(assistMap).length > 0) {
            foundReconciled = true;
            const allGoals = [];
            for (const event of events) {
              if (event.type === 'Goal' && event.detail !== 'Missed Penalty') {
                const isHome = event.team?.id === homeTeam?.id;
                const minute = event.time?.elapsed;
                const extra = event.time?.extra;
                const timeStr = extra ? `${minute}+${extra}'` : `${minute}'`;
                allGoals.push({ isHome, minute, timeStr });
              }
            }

            assists.home = [];
            assists.away = [];
            for (let i = 0; i < allGoals.length; i++) {
              const info = assistMap[i];
              if (info && info.assist) {
                const side = allGoals[i].isHome ? 'home' : 'away';
                assists[side].push({ player: info.assist, minute: allGoals[i].timeStr });
              }
            }
          }
        } catch (err) {
          console.warn('Match details Redis assist error:', err.message);
        }
      }

      // Direct FPL fallback if Redis had nothing — FPL is authoritative for assists
      if (!foundReconciled && (goals.home.length > 0 || goals.away.length > 0)) {
        try {
          const bootstrap = await fplFetch('https://fantasy.premierleague.com/api/bootstrap-static/');
          if (bootstrap) {
            const fplTeams = bootstrap.teams || [];
            const playerMap = {};
            for (const p of bootstrap.elements || []) {
              playerMap[p.id] = p;
            }

            function matchTeamForAssist(apiName, fplTeam) {
              const TEAM_NAME_MAP = {
                'arsenal': 'arsenal', 'aston villa': 'aston villa',
                'bournemouth': 'bournemouth', 'afc bournemouth': 'bournemouth',
                'brentford': 'brentford', 'brighton': 'brighton',
                'brighton and hove albion': 'brighton', 'chelsea': 'chelsea',
                'crystal palace': 'crystal palace', 'everton': 'everton',
                'fulham': 'fulham', 'ipswich': 'ipswich', 'ipswich town': 'ipswich',
                'leicester': 'leicester', 'leicester city': 'leicester',
                'liverpool': 'liverpool', 'manchester city': 'man city',
                'manchester united': 'man utd', 'newcastle': 'newcastle',
                'newcastle united': 'newcastle', 'nottingham forest': "nott'm forest",
                'southampton': 'southampton', 'tottenham': 'spurs',
                'tottenham hotspur': 'spurs', 'west ham': 'west ham',
                'west ham united': 'west ham', 'wolverhampton': 'wolves',
                'wolverhampton wanderers': 'wolves', 'wolves': 'wolves',
              };
              const name = (apiName || '').toLowerCase().trim();
              const fplName = (fplTeam.name || '').toLowerCase().trim();
              if (name === fplName) return true;
              const mapped = TEAM_NAME_MAP[name];
              if (mapped && mapped === fplName) return true;
              const fplShort = (fplTeam.short_name || '').toLowerCase();
              if (fplShort.length >= 3 && name.includes(fplShort)) return true;
              const apiFirst = name.split(/\s+/)[0];
              const fplFirst = fplName.split(/\s+/)[0];
              if (apiFirst.length >= 3 && fplFirst.length >= 3 &&
                  (apiFirst.startsWith(fplFirst) || fplFirst.startsWith(apiFirst))) return true;
              return false;
            }

            const fplHome = fplTeams.find(t => matchTeamForAssist(homeTeam?.name, t));
            const fplAway = fplTeams.find(t => matchTeamForAssist(awayTeam?.name, t));

            if (fplHome && fplAway) {
              const fplFixtures = await fplFetch('https://fantasy.premierleague.com/api/fixtures/');
              if (fplFixtures) {
                const apiKickoff = fixture.fixture?.date ? new Date(fixture.fixture.date).getTime() : null;

                const fplFixture = fplFixtures.find(f => {
                  const hasTeams = (f.team_h === fplHome.id && f.team_a === fplAway.id) ||
                                   (f.team_h === fplAway.id && f.team_a === fplHome.id);
                  if (!hasTeams) return false;
                  if (apiKickoff && f.kickoff_time) {
                    const fplKickoff = new Date(f.kickoff_time).getTime();
                    return Math.abs(apiKickoff - fplKickoff) < 2 * 60 * 60 * 1000;
                  }
                  return false;
                });

                if (fplFixture) {
                  const swapped = fplFixture.team_h === fplAway.id;
                  let fplHomeAssists = [];
                  let fplAwayAssists = [];

                  // Try fixture stats first
                  const assistStat = fplFixture.stats ? fplFixture.stats.find(s => s.identifier === 'assists') : null;
                  if (assistStat) {
                    const homeEntries = swapped ? assistStat.a : assistStat.h;
                    const awayEntries = swapped ? assistStat.h : assistStat.a;
                    for (const entry of (homeEntries || [])) {
                      const player = playerMap[entry.element];
                      if (player) {
                        for (let i = 0; i < entry.value; i++) fplHomeAssists.push(player.web_name);
                      }
                    }
                    for (const entry of (awayEntries || [])) {
                      const player = playerMap[entry.element];
                      if (player) {
                        for (let i = 0; i < entry.value; i++) fplAwayAssists.push(player.web_name);
                      }
                    }
                  }

                  // If fixture stats empty, try FPL live endpoint
                  if (fplHomeAssists.length === 0 && fplAwayAssists.length === 0 &&
                      fplFixture.started && !fplFixture.finished_provisional) {
                    try {
                      const liveData = await fplFetch(`https://fantasy.premierleague.com/api/event/${fplFixture.event}/live/`);
                      if (liveData && liveData.elements) {
                        const fixtureTeamIds = [fplFixture.team_h, fplFixture.team_a];
                        const fixturePlayers = (bootstrap.elements || []).filter(p => fixtureTeamIds.includes(p.team));
                        const homeTeamId = swapped ? fplFixture.team_a : fplFixture.team_h;

                        for (const fp of fixturePlayers) {
                          const liveEl = liveData.elements.find(e => e.id === fp.id);
                          if (liveEl && liveEl.stats && liveEl.stats.assists > 0) {
                            const fixtureExplain = liveEl.explain?.find(ex => ex.fixture === fplFixture.id);
                            let assistsInFixture = 0;
                            if (fixtureExplain) {
                              const aStat = fixtureExplain.stats?.find(s => s.identifier === 'assists');
                              assistsInFixture = aStat ? aStat.value : 0;
                            } else {
                              assistsInFixture = liveEl.stats.assists;
                            }
                            if (assistsInFixture > 0) {
                              for (let i = 0; i < assistsInFixture; i++) {
                                if (fp.team === homeTeamId) {
                                  fplHomeAssists.push(fp.web_name);
                                } else {
                                  fplAwayAssists.push(fp.web_name);
                                }
                              }
                            }
                          }
                        }
                      }
                    } catch (liveErr) {
                      console.warn('Match details FPL live endpoint error:', liveErr.message);
                    }
                  }

                  // FPL is authoritative — replace assists entirely when FPL has data
                  if (fplHomeAssists.length > 0 || fplAwayAssists.length > 0) {
                    assists.home = [];
                    assists.away = [];
                    for (let i = 0; i < fplHomeAssists.length && i < goals.home.length; i++) {
                      assists.home.push({ player: fplHomeAssists[i], minute: goals.home[i]?.minute || '' });
                    }
                    for (let i = 0; i < fplAwayAssists.length && i < goals.away.length; i++) {
                      assists.away.push({ player: fplAwayAssists[i], minute: goals.away[i]?.minute || '' });
                    }
                  }
                }
              }
            }
          }
        } catch (err) {
          console.warn('Match details FPL assist fallback error:', err.message);
        }
      }
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
      const fplFixtures = await fplFetch('https://fantasy.premierleague.com/api/fixtures/');
      if (fplFixtures) {
        const bootstrap = await fplFetch('https://fantasy.premierleague.com/api/bootstrap-static/');
        if (bootstrap) {
          const fplTeams = bootstrap.teams || [];

          function matchTeamForBonus(apiName, fplTeam) {
            const TEAM_NAME_MAP = {
              'arsenal': 'arsenal', 'aston villa': 'aston villa',
              'bournemouth': 'bournemouth', 'afc bournemouth': 'bournemouth',
              'brentford': 'brentford', 'brighton': 'brighton',
              'brighton and hove albion': 'brighton', 'chelsea': 'chelsea',
              'crystal palace': 'crystal palace', 'everton': 'everton',
              'fulham': 'fulham', 'ipswich': 'ipswich', 'ipswich town': 'ipswich',
              'leicester': 'leicester', 'leicester city': 'leicester',
              'liverpool': 'liverpool', 'manchester city': 'man city',
              'manchester united': 'man utd', 'newcastle': 'newcastle',
              'newcastle united': 'newcastle', 'nottingham forest': "nott'm forest",
              'southampton': 'southampton', 'tottenham': 'spurs',
              'tottenham hotspur': 'spurs', 'west ham': 'west ham',
              'west ham united': 'west ham', 'wolverhampton': 'wolves',
              'wolverhampton wanderers': 'wolves', 'wolves': 'wolves',
            };
            const name = (apiName || '').toLowerCase().trim();
            const fplName = (fplTeam.name || '').toLowerCase().trim();
            if (name === fplName) return true;
            const mapped = TEAM_NAME_MAP[name];
            if (mapped && mapped === fplName) return true;
            const fplShort = (fplTeam.short_name || '').toLowerCase();
            if (fplShort.length >= 3 && name.includes(fplShort)) return true;
            const apiFirst = name.split(/\s+/)[0];
            const fplFirst = fplName.split(/\s+/)[0];
            if (apiFirst.length >= 3 && fplFirst.length >= 3 &&
                (apiFirst.startsWith(fplFirst) || fplFirst.startsWith(apiFirst))) return true;
            return false;
          }

          const fplHome = fplTeams.find(t => matchTeamForBonus(homeTeam?.name, t));
          const fplAway = fplTeams.find(t => matchTeamForBonus(awayTeam?.name, t));

          if (fplHome && fplAway) {
            // Match by kickoff time to guarantee exact same fixture
            const apiKickoff = fixture.fixture?.date ? new Date(fixture.fixture.date).getTime() : null;

            const fplFixture = fplFixtures.find(f => {
              const hasTeams = (f.team_h === fplHome.id && f.team_a === fplAway.id) ||
                               (f.team_h === fplAway.id && f.team_a === fplHome.id);
              if (!hasTeams) return false;
              if (apiKickoff && f.kickoff_time) {
                const fplKickoff = new Date(f.kickoff_time).getTime();
                return Math.abs(apiKickoff - fplKickoff) < 2 * 60 * 60 * 1000;
              }
              return false;
            });

            if (fplFixture?.stats) {
              const bonusSwapped = fplFixture.team_h === fplAway.id;
              const bonusStat = fplFixture.stats.find(s => s.identifier === 'bonus');
              if (bonusStat) {
                const playerMap = {};
                for (const p of bootstrap.elements || []) {
                  playerMap[p.id] = p;
                }

                const homeBonusEntries = bonusSwapped ? bonusStat.a : bonusStat.h;
                const awayBonusEntries = bonusSwapped ? bonusStat.h : bonusStat.a;

                for (const entry of (homeBonusEntries || [])) {
                  const player = playerMap[entry.element];
                  if (player) {
                    bonus.home.push({ player: player.web_name, value: entry.value });
                  }
                }
                for (const entry of (awayBonusEntries || [])) {
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
