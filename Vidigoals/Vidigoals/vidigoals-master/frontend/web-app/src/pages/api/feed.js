/**
 * API Route: /api/feed
 *
 * Fetches Premier League fixture events from API-Football.
 *
 * STRATEGY:
 * - Finished match events are cached permanently (they never change)
 * - Only live/in-progress matches trigger fresh API calls for events
 * - Shows last 7 days of events (or last 100 events if more)
 * - Polling only checks for live matches + today's fixtures
 *
 * Premier League ID: 39 | Season: 2024
 */

const API_KEY = process.env.API_FOOTBALL_KEY;
const BASE_URL = 'https://v3.football.api-sports.io';
const PL_LEAGUE_ID = 39;
const SEASON = 2024;

// ── Persistent event store ────────────────────────────────────────────────────
// Stores finished match events permanently — they never change.
// Key: fixtureId, Value: { events: [...], teams, fixture, fetchedAt }
const finishedStore = new Map();

// Short-lived cache for the full feed response
let feedCache = { data: null, fetchedAt: 0, isLive: false };
const CACHE_TTL_LIVE = 30 * 1000;      // 30s when live
const CACHE_TTL_IDLE = 5 * 60 * 1000;  // 5min when idle

function isFeedCacheValid() {
  if (!feedCache.data) return false;
  const ttl = feedCache.isLive ? CACHE_TTL_LIVE : CACHE_TTL_IDLE;
  return Date.now() - feedCache.fetchedAt < ttl;
}

// ── API helper ────────────────────────────────────────────────────────────────
async function apiFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'x-apisports-key': API_KEY },
  });
  if (!res.ok) throw new Error(`API-Football error: ${res.status}`);
  return res.json();
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function dateStr(daysAgo = 0) {
  return new Date(Date.now() - daysAgo * 86400000).toISOString().split('T')[0];
}

// ── Build feed ────────────────────────────────────────────────────────────────
async function buildFeed() {
  const sevenDaysAgo = Date.now() - 7 * 86400000;
  let isLive = false;
  let apiCalls = 0;

  // Step 1: Check for live matches (1 API call)
  const liveData = await apiFetch(`/fixtures?live=all&league=${PL_LEAGUE_ID}&season=${SEASON}`);
  apiCalls++;
  const liveFixtures = liveData.response || [];
  if (liveFixtures.length > 0) isLive = true;

  // Step 2: Get today's fixtures (1 API call) — catches recently finished matches
  const todayData = await apiFetch(`/fixtures?date=${dateStr(0)}&league=${PL_LEAGUE_ID}&season=${SEASON}`);
  apiCalls++;
  const todayFixtures = todayData.response || [];

  // Step 3: For any dates in the last 7 days we haven't cached, fetch them
  // Only fetch a past date if we don't already have all its fixtures stored
  const datesToCheck = [];
  for (let d = 1; d <= 7; d++) {
    datesToCheck.push(dateStr(d));
  }

  // Check which dates we might be missing fixtures for
  const pastFixtures = [];
  for (const date of datesToCheck) {
    // Check if we already have fixtures for this date in our store
    const storedForDate = [...finishedStore.values()].filter(
      f => f.fixture?.date?.startsWith(date)
    );
    if (storedForDate.length > 0) {
      // Already have this date cached — no API call needed
      continue;
    }
    // Don't have this date — fetch it (1 API call per missing date)
    try {
      const data = await apiFetch(`/fixtures?date=${date}&league=${PL_LEAGUE_ID}&season=${SEASON}`);
      apiCalls++;
      const fixtures = data.response || [];
      pastFixtures.push(...fixtures);
    } catch {}
  }

  // Step 4: Combine all fixtures and process events
  const allFixtures = [...liveFixtures, ...todayFixtures, ...pastFixtures];

  // Process each fixture
  for (const fixture of allFixtures) {
    const fixId = fixture.fixture?.id;
    if (!fixId) continue;

    const status = fixture.fixture?.status?.short;
    const isFinished = ['FT', 'AET', 'PEN'].includes(status);

    // If finished and already stored, skip — no API call needed
    if (isFinished && finishedStore.has(fixId)) continue;

    // If events are missing, fetch them (only for fixtures we don't have)
    let events = fixture.events || [];
    if (events.length === 0 && fixId) {
      try {
        const evData = await apiFetch(`/fixtures/events?fixture=${fixId}`);
        apiCalls++;
        events = evData.response || [];
      } catch {}
    }

    // Store finished matches permanently
    if (isFinished) {
      finishedStore.set(fixId, {
        fixture: fixture.fixture,
        teams: fixture.teams,
        events,
        fetchedAt: Date.now(),
      });
    }
  }

  // Step 5: Build the feed from stored + live data
  const feed = [];

  // Add events from finished store (last 7 days)
  for (const [fixId, stored] of finishedStore) {
    const fixDate = new Date(stored.fixture?.date || 0).getTime();
    if (fixDate < sevenDaysAgo) continue; // Skip older than 7 days

    addFixtureEvents(feed, stored.fixture, stored.teams, stored.events);
  }

  // Add events from live fixtures (always fresh)
  for (const fixture of liveFixtures) {
    const events = fixture.events || [];
    addFixtureEvents(feed, fixture.fixture, fixture.teams, events);
  }

  // Add events from today's non-live fixtures that aren't in store yet
  for (const fixture of todayFixtures) {
    const fixId = fixture.fixture?.id;
    if (finishedStore.has(fixId)) continue; // Already added from store
    if (liveFixtures.some(lf => lf.fixture?.id === fixId)) continue; // Already added as live
    const events = fixture.events || [];
    if (events.length > 0) {
      addFixtureEvents(feed, fixture.fixture, fixture.teams, events);
    }
  }

  // Sort by most recent first (by date, then by minute)
  feed.sort((a, b) => {
    const dateCompare = new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
    if (dateCompare !== 0) return dateCompare;
    return (b.minute || 0) - (a.minute || 0);
  });

  // Cap at 100 events
  const cappedFeed = feed.slice(0, 100);

  return { feed: cappedFeed, isLive, fixtureCount: allFixtures.length, apiCalls };
}

// ── Event builder ─────────────────────────────────────────────────────────────
function addFixtureEvents(feed, fix, teams, events) {
  if (!fix || !teams || !events || events.length === 0) return;

  const homeTeam  = teams.home;
  const awayTeam  = teams.away;
  const homeGoals = fix.goals?.home ?? 0;
  const awayGoals = fix.goals?.away ?? 0;

  // HT marker
  if (fix.score?.halftime?.home !== null && fix.score?.halftime?.home !== undefined) {
    feed.push({
      id: `${fix.id}-HT`,
      type: 'HT',
      minute: 45,
      score: `${homeTeam?.name} ${fix.score.halftime.home} - ${fix.score.halftime.away} ${awayTeam?.name}`,
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
  if (['FT', 'AET', 'PEN'].includes(fix.status?.short)) {
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

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  // Return cached feed if still valid
  if (isFeedCacheValid()) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(feedCache.data);
  }

  try {
    const result = await buildFeed();

    feedCache = {
      data: result,
      fetchedAt: Date.now(),
      isLive: result.isLive,
    };

    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(result);
  } catch (err) {
    console.error('Feed error:', err.message);

    // Return stale cache if available
    if (feedCache.data) {
      res.setHeader('X-Cache', 'STALE');
      return res.status(200).json({ ...feedCache.data, stale: true });
    }

    return res.status(500).json({ error: err.message });
  }
}
