/**
 * API Route: /api/assist-check
 *
 * Called internally by the feed system during live matches.
 * Checks FPL for assist updates and reconciles with our tracked goals.
 *
 * This runs as part of the 30-second polling cycle.
 */

import { recordGoal, reconcileAssists, getFixtureAssists, finalizeFixture } from '../../lib/assist-tracker';

async function fplFetch(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VidiGoals/1.0)' },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * Get FPL assists for a fixture by matching team names.
 * Returns array of assist player names in order they were added.
 */
async function getFplAssistsForFixture(homeTeamName, awayTeamName, kickoffTime) {
  const bootstrap = await fplFetch('https://fantasy.premierleague.com/api/bootstrap-static/');
  if (!bootstrap) return { assists: [], count: 0 };

  const fplTeams = bootstrap.teams || [];
  const playerMap = {};
  for (const p of bootstrap.elements || []) {
    playerMap[p.id] = p;
  }

  // Match teams
  const homeNameLower = (homeTeamName || '').toLowerCase();
  const awayNameLower = (awayTeamName || '').toLowerCase();

  function matchTeam(apiName, fplTeam) {
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
    return false;
  }

  const fplHome = fplTeams.find(t => matchTeam(homeTeamName, t));
  const fplAway = fplTeams.find(t => matchTeam(awayTeamName, t));

  if (!fplHome || !fplAway) return { assists: [], count: 0 };

  // Get FPL fixtures
  const fplFixtures = await fplFetch('https://fantasy.premierleague.com/api/fixtures/');
  if (!fplFixtures) return { assists: [], count: 0 };

  // Match by kickoff time if provided, otherwise use team IDs + started filter
  const apiKickoff = kickoffTime ? new Date(kickoffTime).getTime() : null;

  const fplFixture = fplFixtures.find(f => {
    const hasTeams = (f.team_h === fplHome.id && f.team_a === fplAway.id) ||
                     (f.team_h === fplAway.id && f.team_a === fplHome.id);
    if (!hasTeams) return false;
    if (apiKickoff && f.kickoff_time) {
      const fplKickoff = new Date(f.kickoff_time).getTime();
      return Math.abs(apiKickoff - fplKickoff) < 2 * 60 * 60 * 1000;
    }
    // Fallback without kickoff time: must be started (current fixture)
    return f.started === true;
  });

  if (!fplFixture?.stats) {
    // No stats — try live endpoint for live matches
    if (fplFixture && fplFixture.started && !fplFixture.finished_provisional) {
      try {
        const liveData = await fplFetch(`https://fantasy.premierleague.com/api/event/${fplFixture.event}/live/`);
        if (liveData && liveData.elements) {
          const fixtureTeamIds = [fplFixture.team_h, fplFixture.team_a];
          const fixturePlayers = (bootstrap.elements || []).filter(p => fixtureTeamIds.includes(p.team));
          const teamsSwapped = fplFixture.team_h === fplAway.id;
          const homeTeamId = teamsSwapped ? fplFixture.team_a : fplFixture.team_h;

          const allAssists = [];
          const homeAssistPlayers = [];
          const awayAssistPlayers = [];

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
                    homeAssistPlayers.push(fp.web_name);
                  } else {
                    awayAssistPlayers.push(fp.web_name);
                  }
                }
              }
            }
          }

          allAssists.push(...homeAssistPlayers, ...awayAssistPlayers);
          return { assists: allAssists, count: allAssists.length };
        }
      } catch {}
    }
    return { assists: [], count: 0 };
  }

  const teamsSwapped = fplFixture.team_h === fplAway.id;

  const assistStat = fplFixture.stats.find(s => s.identifier === 'assists');
  if (!assistStat) {
    // No assist stat in fixture stats — try live endpoint
    if (fplFixture.started && !fplFixture.finished_provisional) {
      try {
        const liveData = await fplFetch(`https://fantasy.premierleague.com/api/event/${fplFixture.event}/live/`);
        if (liveData && liveData.elements) {
          const fixtureTeamIds = [fplFixture.team_h, fplFixture.team_a];
          const fixturePlayers = (bootstrap.elements || []).filter(p => fixtureTeamIds.includes(p.team));
          const homeTeamId = teamsSwapped ? fplFixture.team_a : fplFixture.team_h;

          const allAssists = [];
          const homeAssistPlayers = [];
          const awayAssistPlayers = [];

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
                    homeAssistPlayers.push(fp.web_name);
                  } else {
                    awayAssistPlayers.push(fp.web_name);
                  }
                }
              }
            }
          }

          allAssists.push(...homeAssistPlayers, ...awayAssistPlayers);
          return { assists: allAssists, count: allAssists.length };
        }
      } catch {}
    }
    return { assists: [], count: 0 };
  }

  // When teams are swapped, adjust which side is home/away
  const homeAssists = teamsSwapped ? assistStat.a : assistStat.h;
  const awayAssists = teamsSwapped ? assistStat.h : assistStat.a;

  // Combine home and away assists in order
  const allAssists = [];
  for (const entry of (homeAssists || [])) {
    const player = playerMap[entry.element];
    if (player) {
      for (let i = 0; i < entry.value; i++) {
        allAssists.push(player.web_name);
      }
    }
  }
  for (const entry of (awayAssists || [])) {
    const player = playerMap[entry.element];
    if (player) {
      for (let i = 0; i < entry.value; i++) {
        allAssists.push(player.web_name);
      }
    }
  }

  // If fixture stats had assists identifier but it was empty, try live endpoint
  if (allAssists.length === 0 && fplFixture.started && !fplFixture.finished_provisional) {
    try {
      const liveData = await fplFetch(`https://fantasy.premierleague.com/api/event/${fplFixture.event}/live/`);
      if (liveData && liveData.elements) {
        const fixtureTeamIds = [fplFixture.team_h, fplFixture.team_a];
        const fixturePlayers = (bootstrap.elements || []).filter(p => fixtureTeamIds.includes(p.team));
        const homeTeamId = teamsSwapped ? fplFixture.team_a : fplFixture.team_h;

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
                  allAssists.push(fp.web_name);
                } else {
                  allAssists.push(fp.web_name);
                }
              }
            }
          }
        }
      }
    } catch {}
  }

  return { assists: allAssists, count: allAssists.length };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { fixtureId, homeTeam, awayTeam, goals, isFinished, kickoffTime } = req.body || {};

  if (!fixtureId) return res.status(400).json({ error: 'fixtureId required' });

  try {
    // Get current FPL assists for this fixture (use kickoff time for exact match)
    const { assists: fplAssists, count: fplAssistCount } = await getFplAssistsForFixture(homeTeam, awayTeam, kickoffTime);

    // Record any new goals we haven't seen before
    if (goals && goals.length > 0) {
      const existingAssists = await getFixtureAssists(fixtureId);

      for (let i = 0; i < goals.length; i++) {
        if (!existingAssists[i]) {
          // New goal — record it
          await recordGoal({
            fixtureId,
            goalIndex: i,
            player: goals[i].player,
            apiAssist: goals[i].assist || null,
            fplAssistCountAtGoal: fplAssistCount,
            timestamp: Date.now(),
          });
        }
      }
    }

    // Reconcile assists
    const updates = await reconcileAssists(fixtureId, fplAssists, fplAssistCount);

    // If match finished, finalize all remaining
    if (isFinished) {
      await finalizeFixture(fixtureId, fplAssists);
    }

    // Get current state of all assists for this fixture
    const currentAssists = await getFixtureAssists(fixtureId);

    return res.status(200).json({
      fixtureId,
      fplAssistCount,
      fplAssists,
      assists: currentAssists,
      updates,
    });
  } catch (err) {
    console.error('Assist check error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
