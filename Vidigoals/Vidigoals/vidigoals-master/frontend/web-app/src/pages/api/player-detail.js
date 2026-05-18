/**
 * API Route: /api/player-detail?id={elementId}&gw={gameweek}
 *
 * Returns detailed player stats for a specific GW including:
 * - Points breakdown (from FPL live explain array)
 * - xG, xA (from FPL live stats)
 * - Fixture score
 * - Player info
 */

async function fplFetch(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VidiGoals/1.0)' },
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const { id, gw } = req.query;
  if (!id || !gw) return res.status(400).json({ error: 'id and gw required' });

  try {
    const [bootstrap, liveData, fixtures] = await Promise.all([
      fplFetch('https://fantasy.premierleague.com/api/bootstrap-static/'),
      fplFetch(`https://fantasy.premierleague.com/api/event/${gw}/live/`),
      fplFetch('https://fantasy.premierleague.com/api/fixtures/'),
    ]);

    if (!bootstrap || !liveData) {
      return res.status(500).json({ error: 'Could not fetch FPL data' });
    }

    // Find player in bootstrap
    const player = bootstrap.elements.find(p => p.id === Number(id));
    if (!player) return res.status(404).json({ error: 'Player not found' });

    const team = bootstrap.teams.find(t => t.id === player.team);

    // Find player's live data
    const liveEl = liveData.elements.find(e => e.id === Number(id));
    const stats = liveEl?.stats || {};
    const explain = liveEl?.explain || [];

    // Find the fixture for this player in this GW
    const gwFixtures = (fixtures || []).filter(f => f.event == gw);
    const playerFixture = gwFixtures.find(f => f.team_h === player.team || f.team_a === player.team);

    let fixtureInfo = null;
    if (playerFixture) {
      const homeTeam = bootstrap.teams.find(t => t.id === playerFixture.team_h);
      const awayTeam = bootstrap.teams.find(t => t.id === playerFixture.team_a);
      fixtureInfo = {
        home: homeTeam?.name || '',
        away: awayTeam?.name || '',
        homeShort: homeTeam?.short_name || '',
        awayShort: awayTeam?.short_name || '',
        homeScore: playerFixture.team_h_score,
        awayScore: playerFixture.team_a_score,
        finished: playerFixture.finished || playerFixture.finished_provisional,
        started: playerFixture.started,
        minutes: playerFixture.minutes,
      };
    }

    // Build points breakdown from explain array
    const breakdown = [];
    for (const ex of explain) {
      if (ex.fixture === playerFixture?.id) {
        for (const stat of (ex.stats || [])) {
          // Show all stats that have a value or points
          if (stat.points !== 0 || stat.value !== 0) {
            breakdown.push({
              identifier: stat.identifier,
              value: stat.value,
              points: stat.points,
            });
          }
        }
      }
    }

    // Stat name mapping for display
    const statNames = {
      'minutes': 'Minutes played',
      'goals_scored': 'Goals scored',
      'assists': 'Assists',
      'clean_sheets': 'Clean sheets',
      'goals_conceded': 'Goals conceded',
      'own_goals': 'Own goals',
      'penalties_saved': 'Penalties saved',
      'penalties_missed': 'Penalties missed',
      'yellow_cards': 'Yellow cards',
      'red_cards': 'Red cards',
      'saves': 'Saves',
      'bonus': 'Bonus',
      'bps': 'Bonus Points System',
      'influence': 'Influence',
      'creativity': 'Creativity',
      'threat': 'Threat',
      'ict_index': 'ICT Index',
      'expected_goals': 'Expected Goals (xG)',
      'expected_assists': 'Expected Assists (xA)',
      'expected_goal_involvements': 'Expected Goal Involvements',
      'expected_goals_conceded': 'Expected Goals Conceded',
      'starts': 'Started',
      'defensive_contribution': 'Defensive Contribution',
    };

    const totalPoints = stats.total_points || 0;

    return res.status(200).json({
      player: {
        id: player.id,
        name: `${player.first_name} ${player.second_name}`,
        webName: player.web_name,
        team: team?.name || '',
        teamShort: team?.short_name || '',
        teamId: player.team,
        position: player.element_type,
      },
      totalPoints,
      xG: stats.expected_goals || '0.00',
      xA: stats.expected_assists || '0.00',
      fixture: fixtureInfo,
      breakdown: breakdown.map(b => ({
        stat: statNames[b.identifier] || b.identifier,
        value: b.value,
        points: b.points,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
