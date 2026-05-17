/**
 * API Route: /api/feed
 *
 * Fetches Premier League fixture events from API-Football.
 *
 * Uses the from/to date range approach:
 * - Fetches last 7 days + today in a single API call
 * - Fetches events for each fixture that has finished
 * - Shows goals, cards, subs, HT/FT scores
 * - Reconciles assists with FPL during live matches
 *
 * Premier League: league=39, season=2025
 */

const API_KEY = process.env.API_FOOTBALL_KEY;
const BASE_URL = 'https://v3.football.api-sports.io';

// Import assist tracker (only works if KV is configured)
let assistTracker = null;
try {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    assistTracker = require('../../lib/assist-tracker');
  }
} catch {}

// FPL fetch helper for assist reconciliation
async function fplFetchForAssists(url) {
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
 * Used during live match polling to reconcile assists.
 */
async function getFplAssistsForFixture(homeTeamName, awayTeamName) {
  const bootstrap = await fplFetchForAssists('https://fantasy.premierleague.com/api/bootstrap-static/');
  if (!bootstrap) return { assists: [], count: 0 };

  const fplTeams = bootstrap.teams || [];
  const playerMap = {};
  for (const p of bootstrap.elements || []) {
    playerMap[p.id] = p;
  }

  const homeNameLower = (homeTeamName || '').toLowerCase();
  const awayNameLower = (awayTeamName || '').toLowerCase();

  function matchTeam(apiName, fplTeam) {
    const name = apiName.toLowerCase();
    const fplName = (fplTeam.name || '').toLowerCase();
    const fplShort = (fplTeam.short_name || '').toLowerCase();
    // Direct substring checks
    if (name.includes(fplShort)) return true;
    if (fplName.includes(name.split(' ')[0])) return true;
    // Handle common mismatches: "Manchester United" ↔ "Man Utd", "Manchester City" ↔ "Man City"
    // Check if first 3 chars of each word match
    const apiWords = name.split(/\s+/);
    const fplWords = fplName.split(/\s+/);
    if (apiWords.length > 0 && fplWords.length > 0) {
      const apiFirst3 = apiWords[0].substring(0, 3);
      const fplFirst3 = fplWords[0].substring(0, 3);
      if (apiFirst3 === fplFirst3 && apiWords.length > 1 && fplWords.length > 1) {
        // Both have multiple words and first word starts the same — check second word
        const apiSecond3 = apiWords[1].substring(0, 3);
        const fplSecond3 = fplWords[1].substring(0, 3);
        if (apiSecond3 === fplSecond3) return true;
      }
      // Single word team names (e.g. "Arsenal" ↔ "Arsenal")
      if (apiFirst3 === fplFirst3 && apiWords.length === 1 && fplWords.length === 1) return true;
    }
    // Fallback: check if FPL short_name first 3 chars match API name first 3 chars
    if (name.substring(0, 3) === fplShort.substring(0, 3)) return true;
    return false;
  }

  const fplHome = fplTeams.find(t => matchTeam(homeTeamName, t));
  const fplAway = fplTeams.find(t => matchTeam(awayTeamName, t));

  if (!fplHome || !fplAway) return { assists: [], count: 0 };

  const fplFixtures = await fplFetchForAssists('https://fantasy.premierleague.com/api/fixtures/');
  if (!fplFixtures) return { assists: [], count: 0 };

  // Check both home/away directions — API-Football and FPL may have different home/away
  // Also filter to only current/recent fixtures that have started (have stats)
  let fplFixture = fplFixtures
    .filter(f => (f.team_h === fplHome.id && f.team_a === fplAway.id) && f.started)
    .sort((a, b) => b.event - a.event)[0];

  let teamsSwapped = false;
  if (!fplFixture) {
    // Try reversed — maybe FPL has the teams in opposite positions
    fplFixture = fplFixtures
      .filter(f => (f.team_h === fplAway.id && f.team_a === fplHome.id) && f.started)
      .sort((a, b) => b.event - a.event)[0];
    teamsSwapped = true;
  }

  if (!fplFixture?.stats) return { assists: [], count: 0 };

  const assistStat = fplFixture.stats.find(s => s.identifier === 'assists');
  if (!assistStat) return { assists: [], count: 0 };

  // When teams are swapped, home assists in FPL = away team in our context
  const homeAssists = teamsSwapped ? assistStat.a : assistStat.h;
  const awayAssists = teamsSwapped ? assistStat.h : assistStat.a;

  const allAssists = [];
  for (const entry of (homeAssists || [])) {
    const player = playerMap[entry.element];
    if (player) {
      for (let i = 0; i < entry.value; i++) {
        allAssists.push(player.web_name);
      }
    }
  }
  for (const entry of (awayAssists || [])) {
    const player = playerMap[entry.element];
    if (player) {
      for (let i = 0; i < entry.value; i++) {
        allAssists.push(player.web_name);
      }
    }
  }

  return { assists: allAssists, count: allAssists.length };
}

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

    // ── Assist reconciliation: record goals & reconcile during live matches ──
    if (isInProgress && assistTracker) {
      try {
        // Collect goal events for this fixture
        const goalEvents = events
          .filter(e => e.type === 'Goal' && e.detail !== 'Missed Penalty')
          .map(e => ({
            player: e.player?.name || 'Unknown',
            assist: e.assist?.name || null,
          }));

        if (goalEvents.length > 0) {
          // Get current FPL assist data for this fixture
          const fplData = await getFplAssistsForFixture(homeTeam?.name, awayTeam?.name);
          const existingAssists = await assistTracker.getFixtureAssists(String(fix.id));

          // Record any new goals we haven't tracked yet
          for (let i = 0; i < goalEvents.length; i++) {
            if (!existingAssists[i]) {
              // If FPL already has an assist for this goal index, confirm immediately
              if (fplData.count > i && fplData.assists[i]) {
                await assistTracker.recordGoal({
                  fixtureId: String(fix.id),
                  goalIndex: i,
                  player: goalEvents[i].player,
                  apiAssist: goalEvents[i].assist,
                  fplAssistCountAtGoal: i, // Set to goal's own index so reconciliation sees count > index
                  timestamp: Date.now(),
                });
              } else {
                // FPL hasn't confirmed yet — watch for it
                await assistTracker.recordGoal({
                  fixtureId: String(fix.id),
                  goalIndex: i,
                  player: goalEvents[i].player,
                  apiAssist: goalEvents[i].assist,
                  fplAssistCountAtGoal: fplData.count,
                  timestamp: Date.now(),
                });
              }
            }
          }

          // Reconcile assists with FPL data
          await assistTracker.reconcileAssists(String(fix.id), fplData.assists, fplData.count);
        }
      } catch (err) {
        console.warn(`Assist reconciliation failed for fixture ${fix.id}:`, err.message);
      }
    }

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
        fixtureId: String(fix.id),
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

  // ── Direct FPL assist fallback (works even without Redis) ─────────────────
  // For live matches, if any goals are missing assists, try to fill from FPL directly
  if (isLive) {
    try {
      // Group goals by fixture
      const goalsByFixture = {};
      for (const event of feed) {
        if (event.type === 'Goal' && event.fixtureId) {
          if (!goalsByFixture[event.fixtureId]) goalsByFixture[event.fixtureId] = [];
          goalsByFixture[event.fixtureId].push(event);
        }
      }

      for (const [fid, goals] of Object.entries(goalsByFixture)) {
        // Sort by minute ascending to match FPL order
        goals.sort((a, b) => (a.minute || 0) - (b.minute || 0));

        // Only fetch FPL if at least one goal is missing an assist
        const hasMissing = goals.some(g => !g.assist);
        if (!hasMissing) continue;

        const fplData = await getFplAssistsForFixture(goals[0].homeTeam, goals[0].awayTeam);
        if (fplData.count > 0) {
          // Apply FPL assists to goals that are missing them
          for (let i = 0; i < goals.length && i < fplData.assists.length; i++) {
            if (!goals[i].assist && fplData.assists[i]) {
              goals[i].assist = fplData.assists[i];
            }
          }
        }
      }
    } catch (err) {
      console.warn('Direct FPL assist fallback error:', err.message);
    }
  }

  return { feed: feed.slice(0, 100), isLive, fixtureCount: fixtures.length };
}

// ── Assist reconciliation for live matches ────────────────────────────────────
async function reconcileLiveAssists(feed, isLive) {
  if (!isLive || !assistTracker) return feed;

  try {
    // Find goal events in the feed
    const liveGoals = feed.filter(e => e.type === 'Goal');
    if (liveGoals.length === 0) return feed;

    // Group goals by fixtureId
    const goalsByFixture = {};
    for (const goal of liveGoals) {
      const fid = goal.fixtureId;
      if (!fid) continue;
      if (!goalsByFixture[fid]) goalsByFixture[fid] = [];
      goalsByFixture[fid].push(goal);
    }

    // For each fixture with goals, apply reconciled assists from Redis
    for (const [fixtureId, goals] of Object.entries(goalsByFixture)) {
      const assistMap = await assistTracker.getFixtureAssists(fixtureId);
      if (!assistMap || Object.keys(assistMap).length === 0) continue;

      // Sort goals by minute (ascending) to match goalIndex order
      goals.sort((a, b) => (a.minute || 0) - (b.minute || 0));

      // Apply reconciled assists
      for (let i = 0; i < goals.length; i++) {
        const assistInfo = assistMap[i];
        if (assistInfo) {
          if (assistInfo.status === 'confirmed') {
            goals[i].assist = assistInfo.assist;
          } else if (assistInfo.status === 'no_assist') {
            goals[i].assist = null;
          }
          // If still 'watching', keep API-Football's assist (already set)
        }
      }
    }
  } catch (err) {
    console.warn('Assist reconciliation error:', err.message);
  }

  return feed;
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
    // Even when serving from cache, apply latest reconciled assists for live matches
    if (feedCache.isLive && assistTracker) {
      try {
        const updatedFeed = await reconcileLiveAssists([...feedCache.data.feed], true);
        return res.status(200).json({ ...feedCache.data, feed: updatedFeed });
      } catch {}
    }
    return res.status(200).json(feedCache.data);
  }

  try {
    const result = await buildFeed();

    // Reconcile assists for live matches
    if (result.isLive && assistTracker) {
      result.feed = await reconcileLiveAssists(result.feed, result.isLive);
    }

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
