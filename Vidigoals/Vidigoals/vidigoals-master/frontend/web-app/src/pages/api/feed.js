/**
 * API Route: /api/feed
 *
 * Fetches Premier League fixture events from API-Football.
 *
 * Uses the from/to date range approach:
 * - Fetches last 7 days + today in a single API call
 * - Fetches events for each fixture that has finished
 * - Shows goals, cards, subs, HT/FT scores
 *
 * Premier League: league=39, season=2025
 */

const API_KEY = process.env.API_FOOTBALL_KEY;
const BASE_URL = 'https://v3.football.api-sports.io';

// ── Cache ─────────────────────────────────────────────────────────────────────
let feedCache = { data: null, fetchedAt: 0, isLive: false };
const CACHE_TTL_LIVE = 30 * 1000;
const CACHE_TTL_IDLE = 5 * 60 * 1000;

function isCacheValid() {
  if (!feedCache.data) return false;
  const ttl = feedCache.isLive ? CACHE_TTL_LIVE : CACHE_TTL_IDLE;
  return Date.now() - feedCache.fetchedAt < ttl;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function apiFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'x-apisports-key': API_KEY },
  });
  if (!res.ok) throw new Error(`API-Football error: ${res.status}`);
  return res.json();
}

function formatDate(daysAgo = 0) {
  return new Date(Date.now() - daysAgo * 86400000).toISOString().split('T')[0];
}

// ── Build feed ────────────────────────────────────────────────────────────────
async function buildFeed() {
  const today = formatDate(0);
  const sevenDaysAgo = formatDate(7);
  let isLive = false;

  // Single API call: get all PL fixtures from last 7 days to today
  const fixturesData = await apiFetch(
    `/fixtures?league=39&season=2025&from=${sevenDaysAgo}&to=${today}`
  );
  const fixtures = fixturesData.response || [];

  // Check if any are currently live
  const liveStatuses = ['1H', '2H', 'HT', 'ET', 'P', 'BT'];
  isLive = fixtures.some(f => liveStatuses.includes(f.fixture?.status?.short));

  // Build event feed
  const feed = [];

  for (const fixture of fixtures) {
    const fix = fixture.fixture;
    const teams = fixture.teams;
    let events = fixture.events || [];

    if (!fix || !teams) continue;

    const status = fix.status?.short;
    const isFinished = ['FT', 'AET', 'PEN'].includes(status);
    const isInProgress = liveStatuses.includes(status);

    // Skip fixtures that haven't started
    if (!isFinished && !isInProgress) continue;

    // If no events inline, fetch by fixture ID (includes events)
    if (events.length === 0 && fix.id) {
      try {
        const fullData = await apiFetch(`/fixtures?id=${fix.id}`);
        const fullFixture = fullData.response?.[0];
        if (fullFixture?.events?.length > 0) {
          events = fullFixture.events;
        }
      } catch {}
    }

    const homeTeam = teams.home;
    const awayTeam = teams.away;
    const homeGoals = fixture.goals?.home ?? 0;
    const awayGoals = fixture.goals?.away ?? 0;

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
    if (isFinished) {
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

    // Individual events (goals, cards, subs)
    if (events.length === 0) continue;

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

  return { feed: feed.slice(0, 100), isLive, fixtureCount: fixtures.length };
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
