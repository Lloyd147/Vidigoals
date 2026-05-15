/**
 * API Route: /api/feed
 *
 * Fetches Premier League fixture events from API-Football.
 *
 * SIMPLIFIED STRATEGY:
 * - Check live matches (1 call)
 * - Get today's fixtures (1 call)
 * - Get yesterday's fixtures (1 call)
 * - Total: 2-3 API calls per cache miss
 * - Cache: 30s live, 5min idle
 *
 * Premier League ID: 39 | Season: 2024
 */

const API_KEY = process.env.API_FOOTBALL_KEY;
const BASE_URL = 'https://v3.football.api-sports.io';
const PL_LEAGUE_ID = 39;
const SEASON = 2024;

// ── Cache ─────────────────────────────────────────────────────────────────────
let feedCache = { data: null, fetchedAt: 0, isLive: false };
const CACHE_TTL_LIVE = 30 * 1000;
const CACHE_TTL_IDLE = 5 * 60 * 1000;

function isCacheValid() {
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

function dateStr(daysAgo = 0) {
  return new Date(Date.now() - daysAgo * 86400000).toISOString().split('T')[0];
}

// ── Build feed ────────────────────────────────────────────────────────────────
async function buildFeed() {
  let isLive = false;
  const allFixtures = [];

  // 1. Check live matches
  try {
    const liveData = await apiFetch(`/fixtures?live=all&league=${PL_LEAGUE_ID}&season=${SEASON}`);
    const live = liveData.response || [];
    if (live.length > 0) {
      isLive = true;
      allFixtures.push(...live);
    }
  } catch {}

  // 2. Today's fixtures
  try {
    const todayData = await apiFetch(`/fixtures?date=${dateStr(0)}&league=${PL_LEAGUE_ID}&season=${SEASON}`);
    const today = todayData.response || [];
    for (const f of today) {
      if (!allFixtures.some(af => af.fixture?.id === f.fixture?.id)) {
        allFixtures.push(f);
      }
    }
  } catch {}

  // 3. Yesterday's fixtures
  try {
    const yestData = await apiFetch(`/fixtures?date=${dateStr(1)}&league=${PL_LEAGUE_ID}&season=${SEASON}`);
    const yest = yestData.response || [];
    for (const f of yest) {
      if (!allFixtures.some(af => af.fixture?.id === f.fixture?.id)) {
        allFixtures.push(f);
      }
    }
  } catch {}

  // 4. If still empty, try 2 days ago
  if (allFixtures.length === 0) {
    try {
      const data = await apiFetch(`/fixtures?date=${dateStr(2)}&league=${PL_LEAGUE_ID}&season=${SEASON}`);
      const fixtures = data.response || [];
      allFixtures.push(...fixtures);
    } catch {}
  }

  // 5. If still empty, try 3 days ago
  if (allFixtures.length === 0) {
    try {
      const data = await apiFetch(`/fixtures?date=${dateStr(3)}&league=${PL_LEAGUE_ID}&season=${SEASON}`);
      const fixtures = data.response || [];
      allFixtures.push(...fixtures);
    } catch {}
  }

  // Build event feed
  const feed = [];

  for (const fixture of allFixtures) {
    const fix = fixture.fixture;
    const teams = fixture.teams;
    const events = fixture.events || [];

    if (!fix || !teams) continue;

    const homeTeam = teams.home;
    const awayTeam = teams.away;
    const homeGoals = fix.goals?.home ?? fixture.goals?.home ?? 0;
    const awayGoals = fix.goals?.away ?? fixture.goals?.away ?? 0;

    // HT marker
    if (fix.score?.halftime?.home != null) {
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
      const ftHome = fixture.goals?.home ?? homeGoals;
      const ftAway = fixture.goals?.away ?? awayGoals;
      feed.push({
        id: `${fix.id}-FT`,
        type: 'FT',
        minute: 90,
        score: `${homeTeam?.name} ${ftHome} - ${ftAway} ${awayTeam?.name}`,
        homeLogo: homeTeam?.logo,
        awayLogo: awayTeam?.logo,
        homeTeam: homeTeam?.name,
        awayTeam: awayTeam?.name,
        player: null,
        assist: null,
        timestamp: fix.date,
      });
    }

    // Skip if no events
    if (events.length === 0) continue;

    // Individual events
    for (const event of events) {
      const isHome = event.team?.id === homeTeam?.id;
      const teamLogo = isHome ? homeTeam?.logo : awayTeam?.logo;
      const detail = event.detail || '';
      const evType = event.type || '';

      let type = null;
      if (evType === 'Goal') {
        type = detail === 'Missed Penalty' ? 'PenMiss' : 'Goal';
      } else if (evType === 'Card') {
        type = detail.includes('Red') ? 'Red' : 'Yellow';
      } else if (evType === 'subst') {
        type = 'Sub';
      } else if (evType === 'Var' && detail.includes('Goal cancelled')) {
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

  // Sort: newest date first, then highest minute first
  feed.sort((a, b) => {
    const d = new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
    if (d !== 0) return d;
    return (b.minute || 0) - (a.minute || 0);
  });

  return { feed: feed.slice(0, 100), isLive, fixtureCount: allFixtures.length };
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  if (isCacheValid()) {
    return res.status(200).json(feedCache.data);
  }

  try {
    const result = await buildFeed();
    feedCache = { data: result, fetchedAt: Date.now(), isLive: result.isLive };
    return res.status(200).json(result);
  } catch (err) {
    console.error('Feed error:', err.message);
    if (feedCache.data) {
      return res.status(200).json({ ...feedCache.data, stale: true });
    }
    return res.status(500).json({ error: err.message });
  }
}
