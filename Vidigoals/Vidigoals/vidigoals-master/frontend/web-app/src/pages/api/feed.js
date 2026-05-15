/**
 * API Route: /api/feed
 *
 * Fetches live Premier League fixture events from API-Football.
 *
 * CACHING: Results are cached in-memory for 60 seconds (during live matches)
 * or 5 minutes (no live matches). All users share the same cached response,
 * so API-Football is called at most once per cache window regardless of traffic.
 *
 * Premier League ID: 39 | Season: 2024
 */

const API_KEY = process.env.API_FOOTBALL_KEY;
const BASE_URL = 'https://v3.football.api-sports.io';
const PL_LEAGUE_ID = 39;
const SEASON = 2024;

// ── In-memory cache ───────────────────────────────────────────────────────────
// Vercel serverless functions share memory within the same instance.
// This dramatically reduces API calls when multiple users are on the site.
let cache = {
  data: null,
  fetchedAt: 0,
  isLive: false,
};

const CACHE_TTL_LIVE    = 30 * 1000;       // 30 seconds when matches are live
const CACHE_TTL_IDLE    = 5 * 60 * 1000;   // 5 minutes when no live matches

function isCacheValid() {
  if (!cache.data) return false;
  const ttl = cache.isLive ? CACHE_TTL_LIVE : CACHE_TTL_IDLE;
  return Date.now() - cache.fetchedAt < ttl;
}

// ── API helper ────────────────────────────────────────────────────────────────
async function apiFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'x-apisports-key': API_KEY },
  });
  if (!res.ok) throw new Error(`API-Football error: ${res.status}`);
  return res.json();
}

// ── Feed builder ──────────────────────────────────────────────────────────────
async function buildFeed() {
  // 1. Try live fixtures
  let fixturesData = await apiFetch(`/fixtures?live=all&league=${PL_LEAGUE_ID}&season=${SEASON}`);
  let fixtures = fixturesData.response || [];
  const isLive = fixtures.length > 0;

  // 2. Fall back to today's fixtures
  if (!isLive) {
    const today = new Date().toISOString().split('T')[0];
    fixturesData = await apiFetch(`/fixtures?date=${today}&league=${PL_LEAGUE_ID}&season=${SEASON}`);
    fixtures = fixturesData.response || [];
  }

  // 3. Fall back to yesterday's fixtures
  if (fixtures.length === 0) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    fixturesData = await apiFetch(`/fixtures?date=${yesterday}&league=${PL_LEAGUE_ID}&season=${SEASON}`);
    fixtures = fixturesData.response || [];
  }

  // 4. Fall back to 2 days ago
  if (fixtures.length === 0) {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];
    fixturesData = await apiFetch(`/fixtures?date=${twoDaysAgo}&league=${PL_LEAGUE_ID}&season=${SEASON}`);
    fixtures = fixturesData.response || [];
  }

  // 5. Last resort — last 10 fixtures
  if (fixtures.length === 0) {
    fixturesData = await apiFetch(`/fixtures?league=${PL_LEAGUE_ID}&season=${SEASON}&last=10`);
    fixtures = fixturesData.response || [];
  }

  // For finished fixtures that don't have events, fetch events separately
  for (let i = 0; i < fixtures.length; i++) {
    const f = fixtures[i];
    if ((!f.events || f.events.length === 0) && f.fixture?.id) {
      try {
        const evData = await apiFetch(`/fixtures/events?fixture=${f.fixture.id}`);
        fixtures[i] = { ...f, events: evData.response || [] };
      } catch {}
    }
  }

  const feed = [];

  for (const fixture of fixtures) {
    const { fixture: fix, teams } = fixture;
    // Events can be at fixture.events (inline) or as a flat array (fetched separately)
    const events = Array.isArray(fixture.events) ? fixture.events : [];
    if (events.length === 0) continue;

    const homeTeam  = teams?.home;
    const awayTeam  = teams?.away;
    const homeGoals = fix?.goals?.home ?? 0;
    const awayGoals = fix?.goals?.away ?? 0;

    // HT marker
    if (fix?.score?.halftime?.home !== null && fix?.score?.halftime?.home !== undefined) {
      const htHome = fix.score.halftime.home ?? 0;
      const htAway = fix.score.halftime.away ?? 0;
      feed.push({
        id: `${fix.id}-HT`,
        type: 'HT',
        minute: 45,
        score: `${homeTeam?.name} ${htHome} - ${htAway} ${awayTeam?.name}`,
        homeLogo: homeTeam?.logo,
        awayLogo: awayTeam?.logo,
        homeTeam: homeTeam?.name,
        awayTeam: awayTeam?.name,
        player: null,
        assist: null,
        timestamp: fix.date,
      });
    }

    // FT marker
    if (['FT', 'AET', 'PEN'].includes(fix?.status?.short)) {
      feed.push({
        id: `${fix.id}-FT`,
        type: 'FT',
        minute: 90,
        score: `${homeTeam?.name} ${homeGoals} - ${awayGoals} ${awayTeam?.name}`,
        homeLogo: homeTeam?.logo,
        awayLogo: awayTeam?.logo,
        homeTeam: homeTeam?.name,
        awayTeam: awayTeam?.name,
        player: null,
        assist: null,
        timestamp: fix.date,
      });
    }

    // Individual events
    for (const event of events) {
      const isHome   = event.team?.id === homeTeam?.id;
      const teamLogo = isHome ? homeTeam?.logo : awayTeam?.logo;
      const detail   = event.detail || '';
      const evType   = event.type  || '';

      let type = null;
      if (evType === 'Goal') {
        type = detail === 'Missed Penalty' ? 'PenMiss' : 'Goal';
      } else if (evType === 'Card') {
        type = detail.includes('Red') ? 'Red' : 'Yellow';
      } else if (evType === 'subst') {
        type = 'Sub';
      } else if (evType === 'Var' && detail?.includes('Goal cancelled')) {
        type = 'VarGoal';
      }

      if (!type) continue;

      feed.push({
        id: `${fix.id}-${event.time?.elapsed}-${event.player?.id || Math.random()}`,
        type,
        minute: event.time?.elapsed,
        extraMinute: event.time?.extra || null,
        score: `${homeTeam?.name} ${homeGoals} - ${awayGoals} ${awayTeam?.name}`,
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

  // Most recent events first
  feed.sort((a, b) => (b.minute || 0) - (a.minute || 0));

  return { feed, isLive, fixtureCount: fixtures.length };
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  // Return cached data if still valid — no API call needed
  if (isCacheValid()) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json({
      ...cache.data,
      cachedAt: new Date(cache.fetchedAt).toISOString(),
    });
  }

  // Cache miss — fetch fresh data from API-Football
  try {
    const result = await buildFeed();

    // Store in cache
    cache = {
      data: result,
      fetchedAt: Date.now(),
      isLive: result.isLive,
    };

    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json({
      ...result,
      cachedAt: new Date(cache.fetchedAt).toISOString(),
    });
  } catch (err) {
    console.error('Feed error:', err.message);

    // If we have stale cache, return it rather than an error
    if (cache.data) {
      res.setHeader('X-Cache', 'STALE');
      return res.status(200).json({
        ...cache.data,
        cachedAt: new Date(cache.fetchedAt).toISOString(),
        stale: true,
      });
    }

    return res.status(500).json({ error: err.message });
  }
}
