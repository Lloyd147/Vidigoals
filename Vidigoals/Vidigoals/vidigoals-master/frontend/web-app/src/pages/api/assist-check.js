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
async function getFplAssistsForFixture(homeTeamName, awayTeamName) {
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

  const fplHome = fplTeams.find(t =>
    homeNameLower.includes(t.short_name?.toLowerCase()) ||
    t.name?.toLowerCase().includes(homeNameLower.split(' ')[0])
  );
  const fplAway = fplTeams.find(t =>
    awayNameLower.includes(t.short_name?.toLowerCase()) ||
    t.name?.toLowerCase().includes(awayNameLower.split(' ')[0])
  );

  if (!fplHome || !fplAway) return { assists: [], count: 0 };

  // Get FPL fixtures
  const fplFixtures = await fplFetch('https://fantasy.premierleague.com/api/fixtures/');
  if (!fplFixtures) return { assists: [], count: 0 };

  // Find matching fixture (most recent between these teams)
  const fplFixture = fplFixtures
    .filter(f => f.team_h === fplHome.id && f.team_a === fplAway.id)
    .sort((a, b) => b.event - a.event)[0];

  if (!fplFixture?.stats) return { assists: [], count: 0 };

  const assistStat = fplFixture.stats.find(s => s.identifier === 'assists');
  if (!assistStat) return { assists: [], count: 0 };

  // Combine home and away assists in order
  const allAssists = [];
  for (const entry of (assistStat.h || [])) {
    const player = playerMap[entry.element];
    if (player) {
      for (let i = 0; i < entry.value; i++) {
        allAssists.push(player.web_name);
      }
    }
  }
  for (const entry of (assistStat.a || [])) {
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

  const { fixtureId, homeTeam, awayTeam, goals, isFinished } = req.body || {};

  if (!fixtureId) return res.status(400).json({ error: 'fixtureId required' });

  try {
    // Get current FPL assists for this fixture
    const { assists: fplAssists, count: fplAssistCount } = await getFplAssistsForFixture(homeTeam, awayTeam);

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
