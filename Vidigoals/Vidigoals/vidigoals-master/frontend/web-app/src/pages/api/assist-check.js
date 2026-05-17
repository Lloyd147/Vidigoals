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
    const name = (apiName || '').toLowerCase();
    const fplName = (fplTeam.name || '').toLowerCase();
    const fplShort = (fplTeam.short_name || '').toLowerCase();
    if (name.includes(fplShort)) return true;
    if (fplName.includes(name.split(' ')[0])) return true;
    const apiWords = name.split(/\s+/);
    const fplWords = fplName.split(/\s+/);
    if (apiWords.length > 0 && fplWords.length > 0) {
      const apiFirst3 = apiWords[0].substring(0, 3);
      const fplFirst3 = fplWords[0].substring(0, 3);
      if (apiFirst3 === fplFirst3 && apiWords.length > 1 && fplWords.length > 1) {
        const apiSecond3 = apiWords[1].substring(0, 3);
        const fplSecond3 = fplWords[1].substring(0, 3);
        if (apiSecond3 === fplSecond3) return true;
      }
      if (apiFirst3 === fplFirst3 && apiWords.length === 1 && fplWords.length === 1) return true;
    }
    if (name.substring(0, 3) === fplShort.substring(0, 3)) return true;
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

  if (!fplFixture?.stats) return { assists: [], count: 0 };

  const teamsSwapped = fplFixture.team_h === fplAway.id;

  const assistStat = fplFixture.stats.find(s => s.identifier === 'assists');
  if (!assistStat) return { assists: [], count: 0 };

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
