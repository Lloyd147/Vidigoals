/**
 * API Route: /api/feed
 *
 * Fetches live Premier League fixture events from API-Football.
 * Returns a unified feed of goals, cards, subs, pen saves/misses, HT and FT scores.
 *
 * Premier League ID: 39
 * Current season: 2024
 */

const API_KEY = process.env.API_FOOTBALL_KEY;
const BASE_URL = 'https://v3.football.api-sports.io';
const PL_LEAGUE_ID = 39;
const SEASON = 2024;

async function apiFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'x-apisports-key': API_KEY,
    },
  });
  if (!res.ok) throw new Error(`API-Football error: ${res.status}`);
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    // Try live fixtures first
    let fixturesData = await apiFetch(`/fixtures?live=all&league=${PL_LEAGUE_ID}&season=${SEASON}`);
    let fixtures = fixturesData.response || [];

    // If no live games, fall back to today's fixtures
    if (fixtures.length === 0) {
      const today = new Date().toISOString().split('T')[0];
      fixturesData = await apiFetch(`/fixtures?date=${today}&league=${PL_LEAGUE_ID}&season=${SEASON}`);
      fixtures = fixturesData.response || [];
    }

    // If still nothing, get the most recent gameweek fixtures
    if (fixtures.length === 0) {
      fixturesData = await apiFetch(`/fixtures?league=${PL_LEAGUE_ID}&season=${SEASON}&last=10`);
      fixtures = fixturesData.response || [];
    }

    // Build unified event feed across all fixtures
    const feed = [];

    for (const fixture of fixtures) {
      const { fixture: fix, teams, events } = fixture;

      if (!events || events.length === 0) continue;

      const homeTeam = teams?.home;
      const awayTeam = teams?.away;
      const homeScore = fix?.score?.fulltime?.home ?? fix?.goals?.home ?? 0;
      const awayScore = fix?.score?.fulltime?.away ?? fix?.goals?.away ?? 0;

      // Add HT event if applicable
      if (fix?.status?.short === 'HT' || fix?.score?.halftime?.home !== null) {
        const htHome = fix?.score?.halftime?.home ?? 0;
        const htAway = fix?.score?.halftime?.away ?? 0;
        feed.push({
          id: `${fix.id}-HT`,
          type: 'HT',
          minute: 45,
          fixtureId: fix.id,
          score: `${homeTeam?.name} ${htHome} - ${htAway} ${awayTeam?.name}`,
          homeLogo: homeTeam?.logo,
          awayLogo: awayTeam?.logo,
          homeTeam: homeTeam?.name,
          awayTeam: awayTeam?.name,
          player: null,
          assist: null,
          detail: 'Half Time',
          timestamp: fix.date,
        });
      }

      // Add FT event if match finished
      if (['FT', 'AET', 'PEN'].includes(fix?.status?.short)) {
        feed.push({
          id: `${fix.id}-FT`,
          type: 'FT',
          minute: 90,
          fixtureId: fix.id,
          score: `${homeTeam?.name} ${homeScore} - ${awayScore} ${awayTeam?.name}`,
          homeLogo: homeTeam?.logo,
          awayLogo: awayTeam?.logo,
          homeTeam: homeTeam?.name,
          awayTeam: awayTeam?.name,
          player: null,
          assist: null,
          detail: 'Full Time',
          timestamp: fix.date,
        });
      }

      for (const event of events) {
        const eventTeam = event.team;
        const isHome = eventTeam?.id === homeTeam?.id;
        const teamLogo = isHome ? homeTeam?.logo : awayTeam?.logo;
        const opposingLogo = isHome ? awayTeam?.logo : homeTeam?.logo;

        // Determine event type
        let type = null;
        const detail = event.detail || '';
        const eventType = event.type || '';

        if (eventType === 'Goal') {
          if (detail === 'Penalty') type = 'Goal';
          else if (detail === 'Missed Penalty') type = 'PenMiss';
          else type = 'Goal';
        } else if (eventType === 'Card') {
          if (detail === 'Yellow Card') type = 'Yellow';
          else if (detail === 'Red Card') type = 'Red';
          else if (detail === 'Yellow Red Card') type = 'Red';
        } else if (eventType === 'subst') {
          type = 'Sub';
        } else if (eventType === 'Var') {
          if (detail?.includes('Goal cancelled')) type = 'VarGoal';
          else continue;
        }

        if (!type) continue;

        // Current score at time of event
        const currentHomeGoals = fix?.goals?.home ?? 0;
        const currentAwayGoals = fix?.goals?.away ?? 0;

        feed.push({
          id: `${fix.id}-${event.time?.elapsed}-${event.player?.id || Math.random()}`,
          type,
          minute: event.time?.elapsed,
          extraMinute: event.time?.extra || null,
          fixtureId: fix.id,
          score: `${homeTeam?.name} ${currentHomeGoals} - ${currentAwayGoals} ${awayTeam?.name}`,
          homeTeam: homeTeam?.name,
          awayTeam: awayTeam?.name,
          homeLogo: homeTeam?.logo,
          awayLogo: awayTeam?.logo,
          teamLogo,
          player: event.player?.name || null,
          assist: event.assist?.name || null,
          detail,
          isHome,
          timestamp: fix.date,
        });
      }
    }

    // Sort by most recent first (highest minute first, FT/HT at top)
    feed.sort((a, b) => (b.minute || 0) - (a.minute || 0));

    return res.status(200).json({
      feed,
      fixtureCount: fixtures.length,
      isLive: fixtures.some((f) => f.fixture?.status?.short === '1H' || f.fixture?.status?.short === '2H'),
    });
  } catch (err) {
    console.error('Feed error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
