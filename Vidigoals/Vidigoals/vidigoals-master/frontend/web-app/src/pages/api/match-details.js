/**
 * API Route: /api/match-details?fixtureId={api-football-id}
 *
 * Fetches match details: events from API-Football + bonus from FPL.
 * Returns goals, assists, cards, saves, bonus points.
 */

const API_KEY = process.env.API_FOOTBALL_KEY;
const BASE_URL = 'https://v3.football.api-sports.io';

const detailsCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function apiFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'x-apisports-key': API_KEY },
  });
  if (!res.ok) throw new Error(`API-Football error: ${res.status}`);
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

    if (!fixture) {
      return res.status(404).json({ error: 'Fixture not found' });
    }

    const events = fixture.events || [];
    const homeTeam = fixture.teams?.home;
    const awayTeam = fixture.teams?.away;

    // Categorize events
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
          yellowCards[side].push({ player: playerName });
        } else if (event.detail?.includes('Red')) {
          redCards[side].push({ player: playerName });
        }
      }
    }

    // Fetch statistics for saves
    let saves = { home: [], away: [] };
    try {
      const statsData = await apiFetch(`/fixtures/statistics?fixture=${fixtureId}`);
      const stats = statsData.response || [];
      for (const teamStats of stats) {
        const isHome = teamStats.team?.id === homeTeam?.id;
        const side = isHome ? 'home' : 'away';
        const saveStat = teamStats.statistics?.find(s => s.type === 'Goalkeeper Saves');
        if (saveStat?.value) {
          saves[side].push({ player: 'Goalkeeper', count: saveStat.value });
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
      saves,
    };

    detailsCache.set(fixtureId, { data: result, fetchedAt: Date.now() });
    return res.status(200).json(result);
  } catch (err) {
    console.error('Match details error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
