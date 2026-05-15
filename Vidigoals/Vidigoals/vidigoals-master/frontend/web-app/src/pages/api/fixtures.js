/**
 * API Route: /api/fixtures?round={number}
 *
 * Fetches Premier League fixtures for a specific gameweek (round).
 * Uses API-Football which includes team logos.
 *
 * If no round specified, returns the current gameweek.
 */

const API_KEY = process.env.API_FOOTBALL_KEY;
const BASE_URL = 'https://v3.football.api-sports.io';

// Cache per round — rounds don't change once finished
const roundCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

  const round = req.query.round || null;
  const roundLabel = round ? `Regular Season - ${round}` : null;

  // Check cache
  const cacheKey = round || 'current';
  const cached = roundCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return res.status(200).json(cached.data);
  }

  try {
    let fixtures;

    if (roundLabel) {
      // Fetch specific round
      const data = await apiFetch(`/fixtures?league=39&season=2025&round=${encodeURIComponent(roundLabel)}`);
      fixtures = data.response || [];
    } else {
      // Find current round: get today's date range
      const today = new Date().toISOString().split('T')[0];
      const data = await apiFetch(`/fixtures?league=39&season=2025&date=${today}`);
      fixtures = data.response || [];

      // If no fixtures today, get the next upcoming ones
      if (fixtures.length === 0) {
        const nextData = await apiFetch(`/fixtures?league=39&season=2025&next=10`);
        fixtures = nextData.response || [];
      }

      // If still nothing, get the last played round
      if (fixtures.length === 0) {
        const lastData = await apiFetch(`/fixtures?league=39&season=2025&last=10`);
        fixtures = lastData.response || [];
      }
    }

    // Determine the round number from fixtures
    let currentRound = null;
    if (fixtures.length > 0) {
      const roundStr = fixtures[0].league?.round || '';
      const match = roundStr.match(/(\d+)/);
      if (match) currentRound = parseInt(match[1]);
    }

    // Group fixtures by date
    const grouped = {};
    for (const f of fixtures) {
      const date = new Date(f.fixture?.date);
      const dateKey = date.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });

      if (!grouped[dateKey]) grouped[dateKey] = [];

      grouped[dateKey].push({
        id: f.fixture?.id,
        date: f.fixture?.date,
        time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        status: f.fixture?.status?.short,
        statusLong: f.fixture?.status?.long,
        home: {
          name: f.teams?.home?.name,
          logo: f.teams?.home?.logo,
          score: f.goals?.home,
        },
        away: {
          name: f.teams?.away?.name,
          logo: f.teams?.away?.logo,
          score: f.goals?.away,
        },
      });
    }

    const result = {
      round: currentRound,
      totalRounds: 38,
      fixtures: grouped,
      fixtureCount: fixtures.length,
    };

    roundCache.set(cacheKey, { data: result, fetchedAt: Date.now() });
    return res.status(200).json(result);
  } catch (err) {
    console.error('Fixtures error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
