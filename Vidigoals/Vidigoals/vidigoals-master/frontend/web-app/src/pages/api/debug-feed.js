/**
 * Debug endpoint — step by step diagnosis of the feed.
 * Visit /api/debug-feed to see exactly what's happening.
 */

const API_KEY = process.env.API_FOOTBALL_KEY;
const BASE_URL = 'https://v3.football.api-sports.io';

async function apiFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'x-apisports-key': API_KEY },
  });
  return { status: res.status, ok: res.ok, data: await res.json() };
}

function dateStr(daysAgo = 0) {
  return new Date(Date.now() - daysAgo * 86400000).toISOString().split('T')[0];
}

export default async function handler(req, res) {
  if (!API_KEY) return res.status(500).json({ error: 'No API key', keyLength: 0 });

  const debug = {
    apiKeyFirstChars: API_KEY.substring(0, 6) + '...',
    apiKeyLength: API_KEY.length,
    dates: { today: dateStr(0), yesterday: dateStr(1), twoDaysAgo: dateStr(2) },
    steps: [],
  };

  // Step 1: Find fixtures from 2 days ago (Man City game)
  try {
    const result = await apiFetch(`/fixtures?date=${dateStr(2)}&league=39&season=2024`);
    const fixtures = result.data?.response || [];
    debug.steps.push({
      step: '1. Fixtures 2 days ago (season 2024)',
      status: result.status,
      fixtureCount: fixtures.length,
      fixtures: fixtures.map(f => ({
        id: f.fixture?.id,
        date: f.fixture?.date,
        status: f.fixture?.status?.short,
        home: f.teams?.home?.name,
        away: f.teams?.away?.name,
        score: `${f.goals?.home}-${f.goals?.away}`,
        eventsCount: f.events?.length || 0,
        hasScore: f.fixture?.score != null,
      })),
    });

    // Step 2: If we found a fixture, fetch it by ID to get events
    if (fixtures.length > 0) {
      const fixtureId = fixtures[0].fixture?.id;
      const fullResult = await apiFetch(`/fixtures?id=${fixtureId}`);
      const fullFixture = fullResult.data?.response?.[0];
      debug.steps.push({
        step: `2. Full fixture by ID (${fixtureId})`,
        status: fullResult.status,
        hasEvents: (fullFixture?.events?.length || 0) > 0,
        eventsCount: fullFixture?.events?.length || 0,
        eventsSample: (fullFixture?.events || []).slice(0, 3).map(e => ({
          type: e.type,
          detail: e.detail,
          player: e.player?.name,
          minute: e.time?.elapsed,
          team: e.team?.name,
        })),
        goals: fullFixture?.goals,
        score: fullFixture?.score,
        teams: {
          home: fullFixture?.teams?.home?.name,
          away: fullFixture?.teams?.away?.name,
        },
      });
    }
  } catch (e) {
    debug.steps.push({ step: '1-2 ERROR', error: e.message });
  }

  // Step 3: Check today (season 2025)
  try {
    const result = await apiFetch(`/fixtures?date=${dateStr(0)}&league=39&season=2025`);
    debug.steps.push({
      step: '3. Today fixtures (season 2025)',
      status: result.status,
      fixtureCount: result.data?.response?.length || 0,
      errors: result.data?.errors,
    });
  } catch (e) {
    debug.steps.push({ step: '3 ERROR', error: e.message });
  }

  // Step 4: Check API account status
  try {
    const result = await apiFetch('/status');
    debug.steps.push({
      step: '4. API account status',
      status: result.status,
      account: result.data?.response,
    });
  } catch (e) {
    debug.steps.push({ step: '4 ERROR', error: e.message });
  }

  return res.status(200).json(debug);
}
