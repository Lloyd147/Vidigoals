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
 * Get FPL assists for a fixture by matching teams + kickoff time.
 * The kickoff time guarantees we match the exact same fixture, not a previous GW.
 */
async function getFplAssistsForFixture(homeTeamName, awayTeamName, kickoffTime) {
  const bootstrap = await fplFetchForAssists('https://fantasy.premierleague.com/api/bootstrap-static/');
  if (!bootstrap) return { assists: [], count: 0 };

  const fplTeams = bootstrap.teams || [];
  const playerMap = {};
  for (const p of bootstrap.elements || []) {
    playerMap[p.id] = p;
  }

  // Build team ID lookup from FPL — use explicit name mapping for reliability
  // API-Football names → FPL team names (there are only 20 PL teams)
  const TEAM_NAME_MAP = {
    'arsenal': 'arsenal',
    'aston villa': 'aston villa',
    'bournemouth': 'bournemouth',
    'afc bournemouth': 'bournemouth',
    'brentford': 'brentford',
    'brighton': 'brighton',
    'brighton and hove albion': 'brighton',
    'chelsea': 'chelsea',
    'crystal palace': 'crystal palace',
    'everton': 'everton',
    'fulham': 'fulham',
    'ipswich': 'ipswich',
    'ipswich town': 'ipswich',
    'leicester': 'leicester',
    'leicester city': 'leicester',
    'liverpool': 'liverpool',
    'manchester city': 'man city',
    'manchester united': 'man utd',
    'newcastle': 'newcastle',
    'newcastle united': 'newcastle',
    'nottingham forest': "nott'm forest",
    'southampton': 'southampton',
    'tottenham': 'spurs',
    'tottenham hotspur': 'spurs',
    'west ham': 'west ham',
    'west ham united': 'west ham',
    'wolverhampton': 'wolves',
    'wolverhampton wanderers': 'wolves',
    'wolves': 'wolves',
  };

  function matchTeam(apiName, fplTeam) {
    const name = (apiName || '').toLowerCase().trim();
    const fplName = (fplTeam.name || '').toLowerCase().trim();

    // Direct match
    if (name === fplName) return true;

    // Check via mapping (covers all 20 PL teams)
    const mapped = TEAM_NAME_MAP[name];
    if (mapped && mapped === fplName) return true;

    return false;
  }

  const fplHome = fplTeams.find(t => matchTeam(homeTeamName, t));
  const fplAway = fplTeams.find(t => matchTeam(awayTeamName, t));

  if (!fplHome || !fplAway) return { assists: [], count: 0 };

  const fplFixtures = await fplFetchForAssists('https://fantasy.premierleague.com/api/fixtures/');
  if (!fplFixtures) return { assists: [], count: 0 };

  // Match by kickoff time (same date within 2 hours tolerance) + team IDs
  // This guarantees we find the EXACT same fixture, never a previous GW
  const apiKickoff = kickoffTime ? new Date(kickoffTime).getTime() : null;

  function isMatchingFixture(f, homeId, awayId) {
    const hasTeams = (f.team_h === homeId && f.team_a === awayId) ||
                     (f.team_h === awayId && f.team_a === homeId);
    if (!hasTeams) return false;

    // If we have a kickoff time, use it to pin to the exact fixture
    if (apiKickoff && f.kickoff_time) {
      const fplKickoff = new Date(f.kickoff_time).getTime();
      const diff = Math.abs(apiKickoff - fplKickoff);
      return diff < 2 * 60 * 60 * 1000; // Within 2 hours = same fixture
    }

    // Fallback: must have started (current/recent fixture)
    return f.started === true;
  }

  let fplFixture = fplFixtures.find(f => isMatchingFixture(f, fplHome.id, fplAway.id));
  if (!fplFixture) return { assists: [], homeAssists: [], awayAssists: [], count: 0 };

  // Determine if teams are swapped relative to our home/away
  const teamsSwapped = fplFixture.team_h === fplAway.id;

  const assistStat = fplFixture.stats ? fplFixture.stats.find(s => s.identifier === 'assists') : null;

  // When teams are swapped, home assists in FPL = away team in our context
  const homeAssistEntries = assistStat ? (teamsSwapped ? assistStat.a : assistStat.h) : [];
  const awayAssistEntries = assistStat ? (teamsSwapped ? assistStat.h : assistStat.a) : [];

  const allAssists = [];
  const homeAssistNames = [];
  const awayAssistNames = [];
  for (const entry of (homeAssistEntries || [])) {
    const player = playerMap[entry.element];
    if (player) {
      for (let i = 0; i < entry.value; i++) {
        allAssists.push(player.web_name);
        homeAssistNames.push(player.web_name);
      }
    }
  }
  for (const entry of (awayAssistEntries || [])) {
    const player = playerMap[entry.element];
    if (player) {
      for (let i = 0; i < entry.value; i++) {
        allAssists.push(player.web_name);
        awayAssistNames.push(player.web_name);
      }
    }
  }

  // If fixture stats didn't have assists (common during live matches),
  // fall back to the FPL live endpoint which has per-player stats
  if (allAssists.length === 0 && fplFixture.started && !fplFixture.finished_provisional) {
    try {
      const liveData = await fplFetchForAssists(`https://fantasy.premierleague.com/api/event/${fplFixture.event}/live/`);
      if (liveData && liveData.elements) {
        // Get all player IDs for this fixture's teams
        const fixtureTeamIds = [fplFixture.team_h, fplFixture.team_a];
        const fixturePlayers = (bootstrap.elements || []).filter(p => fixtureTeamIds.includes(p.team));

        // Find players with assists in this fixture
        const homeTeamId = teamsSwapped ? fplFixture.team_a : fplFixture.team_h;
        const awayTeamId = teamsSwapped ? fplFixture.team_h : fplFixture.team_a;

        for (const fp of fixturePlayers) {
          const liveEl = liveData.elements.find(e => e.id === fp.id);
          if (liveEl && liveEl.stats && liveEl.stats.assists > 0) {
            // Check this player's explain to confirm assists are from THIS fixture
            const fixtureExplain = liveEl.explain?.find(ex => ex.fixture === fplFixture.id);
            let assistsInFixture = 0;
            if (fixtureExplain) {
              const assistStat2 = fixtureExplain.stats?.find(s => s.identifier === 'assists');
              assistsInFixture = assistStat2 ? assistStat2.value : 0;
            } else {
              // If no explain breakdown, use the total (single fixture in GW scenario)
              assistsInFixture = liveEl.stats.assists;
            }

            if (assistsInFixture > 0) {
              for (let i = 0; i < assistsInFixture; i++) {
                if (fp.team === homeTeamId) {
                  homeAssistNames.push(fp.web_name);
                } else {
                  awayAssistNames.push(fp.web_name);
                }
                allAssists.push(fp.web_name);
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('FPL live endpoint fallback error:', err.message);
    }
  }

  return { assists: allAssists, homeAssists: homeAssistNames, awayAssists: awayAssistNames, count: allAssists.length };
}

// ── Cache ─────────────────────────────────────────────────────────────────────
let feedCache = { data: null, fetchedAt: 0, isLive: false };
const CACHE_TTL_LIVE = 30 * 1000;
const CACHE_TTL_IDLE = 5 * 60 * 1000;

// ── Player Position Cache ─────────────────────────────────────────────────────
// Stores successful player name → FPL position matches across requests
// Persists as long as the serverless instance is alive
const playerPositionCache = new Map();

// ── Live Assist Mapping Store ─────────────────────────────────────────────────
// Tracks FPL assists as they're awarded during live matches.
// Key: fixtureId → { lastKnownAssists: {playerName: count}, mappings: [{player, goalMinute}] }
const liveAssistStore = new Map();

/**
 * During live matches, detect new FPL assists and map them to the most recent
 * goal (within 5 minutes) that doesn't have an assist.
 * This gives us accurate goal-to-assist mapping based on timing.
 */
function reconcileLiveAssistMapping(fixtureId, sideGoals, fplAssistNames, side) {
  const storeKey = `${fixtureId}-${side}`;
  let store = liveAssistStore.get(storeKey);
  if (!store) {
    store = { lastKnownAssists: {}, mappings: [] };
    liveAssistStore.set(storeKey, store);
  }

  // Count current FPL assists per player
  const currentCounts = {};
  for (const name of fplAssistNames) {
    currentCounts[name] = (currentCounts[name] || 0) + 1;
  }

  // Detect NEW assists (count increased since last poll)
  const newAssists = [];
  for (const [player, count] of Object.entries(currentCounts)) {
    const prev = store.lastKnownAssists[player] || 0;
    if (count > prev) {
      // New assist(s) detected for this player
      for (let i = 0; i < count - prev; i++) {
        newAssists.push(player);
      }
    }
  }

  // For each new assist, find the most recent goal without an assist
  // "Most recent" = highest minute that doesn't already have a mapping
  if (newAssists.length > 0) {
    const mappedMinutes = new Set(store.mappings.map(m => m.goalMinute));

    for (const assistPlayer of newAssists) {
      // Find goals without an assist, sorted by minute descending (most recent first)
      const candidates = sideGoals
        .filter(g => !g.assist && !mappedMinutes.has(g.minute))
        .sort((a, b) => (b.minute || 0) - (a.minute || 0));

      if (candidates.length > 0) {
        // Assign to the most recent unassisted goal
        const target = candidates[0];
        store.mappings.push({ player: assistPlayer, goalMinute: target.minute });
        mappedMinutes.add(target.minute);
      }
    }
  }

  // Update last known counts
  store.lastKnownAssists = { ...currentCounts };

  return store.mappings;
}

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

// Shorten long team names for display
function shortName(name) {
  const map = {
    'Manchester City': 'Man City',
    'Manchester United': 'Man Utd',
    'Nottingham Forest': "Nott'm Forest",
    'Crystal Palace': 'C. Palace',
    'Wolverhampton Wanderers': 'Wolves',
    'Tottenham Hotspur': 'Spurs',
    'West Ham United': 'West Ham',
    'Newcastle United': 'Newcastle',
    'Leicester City': 'Leicester',
    'AFC Bournemouth': 'Bournemouth',
  };
  return map[name] || name;
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
          // Get current FPL assist data for this fixture (pass kickoff time for exact match)
          const fplData = await getFplAssistsForFixture(homeTeam?.name, awayTeam?.name, fix.date);
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
        score: `${shortName(homeTeam?.name)} ${fix.score.halftime.home} - ${fix.score.halftime.away} ${shortName(awayTeam?.name)}`,
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
        score: `${shortName(homeTeam?.name)} ${homeGoals} - ${awayGoals} ${shortName(awayTeam?.name)}`,
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

    // Sort events by minute to calculate running score at each event
    const sortedEvents = [...events].sort((a, b) =>
      (a.time?.elapsed || 0) - (b.time?.elapsed || 0) ||
      (a.time?.extra || 0) - (b.time?.extra || 0)
    );

    // Track running score
    let runningHome = 0;
    let runningAway = 0;
    const eventScores = new Map(); // event index → { home, away } at time of event

    for (const event of sortedEvents) {
      const evType = event.type || '';
      const detail = event.detail || '';
      const isGoal = evType === 'Goal' && detail !== 'Missed Penalty';
      const isHomeEvent = event.team?.id === homeTeam?.id;

      if (isGoal) {
        if (isHomeEvent) runningHome++;
        else runningAway++;
      }

      // Store the score AT this event (after the goal is counted)
      const key = `${event.time?.elapsed}-${event.player?.id || ''}-${evType}`;
      eventScores.set(key, { home: runningHome, away: runningAway });
    }

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

      // Get score at the time of this event
      const key = `${event.time?.elapsed}-${event.player?.id || ''}-${evType}`;
      const scoreAtEvent = eventScores.get(key) || { home: runningHome, away: runningAway };

      feed.push({
        id: `${fix.id}-${event.time?.elapsed}-${event.time?.extra || 0}-${evType}-${event.player?.id || event.player?.name || 'unknown'}`,
        type,
        fixtureId: String(fix.id),
        minute: event.time?.elapsed,
        extraMinute: event.time?.extra || null,
        score: `${shortName(homeTeam?.name)} ${scoreAtEvent.home} - ${scoreAtEvent.away} ${shortName(awayTeam?.name)}`,
        homeTeam: homeTeam?.name,
        awayTeam: awayTeam?.name,
        homeScore: scoreAtEvent.home,
        awayScore: scoreAtEvent.away,
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

  // Deduplicate events by ID (API-Football can return same event multiple times)
  const seenIds = new Set();
  const dedupedFeed = [];
  for (const event of feed) {
    if (!seenIds.has(event.id)) {
      seenIds.add(event.id);
      dedupedFeed.push(event);
    }
  }

  // Sort: newest date first, then highest minute first
  dedupedFeed.sort((a, b) => {
    const d = new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
    if (d !== 0) return d;
    return (b.minute || 0) - (a.minute || 0);
  });

  // ── FPL Assist Reconciliation ─────────────────────────────────────────────
  // Rules:
  // 1. Keep API-Football assists (they know the exact goal)
  // 2. FPL total per player is the cap — cannot exceed it
  // 3. Only add FPL assists to goals that API-Football left unassisted
  // 4. Each goal can only have 1 assist
  // 5. Assign remaining FPL assists to most recent unassisted goal (timing-based)
  // e.g. FPL says Bruno:2, API gave Bruno for Mbeumo → 1 remaining → assign to Shaw (most recent unassisted)
  // Cunha gets nothing because all 2 Bruno assists are now accounted for
  try {
    const goalsByFixture = {};
    for (const event of dedupedFeed) {
      if (event.type === 'Goal' && event.fixtureId) {
        if (!goalsByFixture[event.fixtureId]) goalsByFixture[event.fixtureId] = [];
        goalsByFixture[event.fixtureId].push(event);
      }
    }

    for (const [fid, goals] of Object.entries(goalsByFixture)) {
      goals.sort((a, b) => (a.minute || 0) - (b.minute || 0));

      const fplData = await getFplAssistsForFixture(goals[0].homeTeam, goals[0].awayTeam, goals[0].timestamp);
      if (fplData.count === 0) continue;

      const homeGoals = goals.filter(g => g.isHome);
      const awayGoals = goals.filter(g => !g.isHome);

      // Check if fixture is live (no FT marker)
      const fixtureLive = !dedupedFeed.some(e => e.fixtureId === fid && e.type === 'FT');

      function reconcileSide(sideGoals, fplAssistNames, side) {
        if (fplAssistNames.length === 0) return;

        // Count FPL assists per player — this is the maximum allowed
        const fplCounts = {};
        for (const name of fplAssistNames) {
          fplCounts[name] = (fplCounts[name] || 0) + 1;
        }

        // Count how many assists API-Football already assigned per FPL player
        const apiAssignedCounts = {};
        for (const goal of sideGoals) {
          if (goal.assist) {
            for (const fplName of Object.keys(fplCounts)) {
              const fplLast = fplName.split('.').pop()?.toLowerCase() || fplName.toLowerCase();
              const goalLast = goal.assist.split(' ').pop()?.toLowerCase() || goal.assist.toLowerCase();
              if (fplLast === goalLast) {
                apiAssignedCounts[fplName] = (apiAssignedCounts[fplName] || 0) + 1;
                break;
              }
            }
          }
        }

        // Calculate remaining assists to distribute per player
        // remaining = FPL total - already assigned by API-Football
        const remainingPerPlayer = {};
        for (const [player, fplCount] of Object.entries(fplCounts)) {
          const alreadyAssigned = apiAssignedCounts[player] || 0;
          const toAdd = fplCount - alreadyAssigned;
          if (toAdd > 0) {
            remainingPerPlayer[player] = toAdd;
          }
        }

        // No remaining assists to add — done
        if (Object.keys(remainingPerPlayer).length === 0) return;

        // Build flat list of remaining assists to assign
        const toAssign = [];
        for (const [player, count] of Object.entries(remainingPerPlayer)) {
          for (let i = 0; i < count; i++) {
            toAssign.push(player);
          }
        }

        const storeKey = `${fid}-${side}`;
        const store = liveAssistStore.get(storeKey);

        // LIVE: update the tracking store
        if (fixtureLive) {
          reconcileLiveAssistMapping(fid, sideGoals, fplAssistNames, side);
        }

        // Apply stored live mappings if available (works for both live and after FT)
        // This preserves the correct goal-to-assist mapping determined during live
        if (store && store.mappings.length > 0) {
          const usedCount = {};
          for (const mapping of store.mappings) {
            const maxForPlayer = fplCounts[mapping.player] || 0;
            const alreadyUsed = (usedCount[mapping.player] || 0) + (apiAssignedCounts[mapping.player] || 0);
            if (alreadyUsed >= maxForPlayer) continue; // cap: never exceed FPL total

            const goal = sideGoals.find(g => g.minute === mapping.goalMinute && !g.assist);
            if (goal) {
              goal.assist = mapping.player;
              usedCount[mapping.player] = (usedCount[mapping.player] || 0) + 1;
            }
          }
        } else {
          // No live store data — use fallback assignment
          // Live: most recent unassisted goal first
          // Finished: earliest unassisted goal first (best effort)
          const unassistedGoals = sideGoals
            .filter(g => !g.assist)
            .sort((a, b) => fixtureLive
              ? (b.minute || 0) - (a.minute || 0)
              : (a.minute || 0) - (b.minute || 0));

          let assignIdx = 0;
          for (const goal of unassistedGoals) {
            if (assignIdx >= toAssign.length) break;
            goal.assist = toAssign[assignIdx];
            assignIdx++;
          }
        }
      }

      reconcileSide(homeGoals, fplData.homeAssists, 'home');
      reconcileSide(awayGoals, fplData.awayAssists, 'away');
    }
  } catch (err) {
    console.warn('FPL assist reconciliation error:', err.message);
  }

  // ── Add FPL points for goals based on player position ─────────────────────
  // GK/DEF goal = +6, MID goal = +5, FWD goal = +4, Assist = +3 (all positions)
  try {
    const bootstrap = await fplFetchForAssists('https://fantasy.premierleague.com/api/bootstrap-static/');
    if (bootstrap && bootstrap.elements) {
      const fplTeams = bootstrap.teams || [];

      // Strip accents/diacritics for matching
      function normalize(str) {
        return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      }

      // Compact form: strip all dots, spaces, hyphens for fuzzy comparison
      function compact(str) {
        return normalize(str).replace(/[\s.\-']/g, '');
      }

      // Build team ID lookup from API-Football name → FPL team ID
      const TEAM_NAME_MAP = {
        'arsenal': 'arsenal', 'aston villa': 'aston villa',
        'bournemouth': 'bournemouth', 'afc bournemouth': 'bournemouth',
        'brentford': 'brentford', 'brighton': 'brighton',
        'brighton and hove albion': 'brighton', 'chelsea': 'chelsea',
        'crystal palace': 'crystal palace', 'everton': 'everton',
        'fulham': 'fulham', 'ipswich': 'ipswich', 'ipswich town': 'ipswich',
        'leicester': 'leicester', 'leicester city': 'leicester',
        'liverpool': 'liverpool', 'manchester city': 'man city',
        'manchester united': 'man utd', 'newcastle': 'newcastle',
        'newcastle united': 'newcastle', 'nottingham forest': "nott'm forest",
        'southampton': 'southampton', 'tottenham': 'spurs',
        'tottenham hotspur': 'spurs', 'west ham': 'west ham',
        'west ham united': 'west ham', 'wolverhampton': 'wolves',
        'wolverhampton wanderers': 'wolves', 'wolves': 'wolves',
      };

      function getFplTeamId(apiTeamName) {
        const name = (apiTeamName || '').toLowerCase().trim();
        const mapped = TEAM_NAME_MAP[name] || name;
        const fplTeam = fplTeams.find(t => t.name.toLowerCase() === mapped);
        return fplTeam ? fplTeam.id : null;
      }

      // Build lookup: normalized name + team → position
      // Index by multiple keys for robust matching
      const playerIndex = []; // [{normalized names, teamId, position}]
      for (const p of bootstrap.elements) {
        const secondName = normalize(p.second_name || '');
        const webName = normalize(p.web_name || '');
        const firstName = normalize(p.first_name || '');
        const fullName = normalize(`${p.first_name || ''} ${p.second_name || ''}`);
        const compactWeb = compact(p.web_name || '');
        const compactFull = compact(`${p.first_name || ''} ${p.second_name || ''}`);
        playerIndex.push({
          secondName,
          webName,
          firstName,
          fullName,
          compactWeb,
          compactFull,
          teamId: p.team,
          position: p.element_type,
        });
      }

      function findPlayerPosition(apiPlayerName, apiTeamName) {
        // Check stored cache first
        const cacheKey = normalize(apiPlayerName);
        if (playerPositionCache.has(cacheKey)) {
          return playerPositionCache.get(cacheKey);
        }

        const normalizedPlayer = normalize(apiPlayerName);
        const playerLast = normalizedPlayer.split(' ').pop() || '';
        const fplTeamId = getFplTeamId(apiTeamName);

        // Try exact full name match with team
        let match = playerIndex.find(p =>
          p.fullName === normalizedPlayer && (!fplTeamId || p.teamId === fplTeamId)
        );

        // Try last name + team match
        if (!match && fplTeamId) {
          match = playerIndex.find(p =>
            (p.secondName === playerLast || p.webName === playerLast) && p.teamId === fplTeamId
          );
        }

        // Try web_name match with team (handles "Le Fee" style names)
        if (!match && fplTeamId) {
          match = playerIndex.find(p =>
            normalizedPlayer.includes(p.webName) && p.webName.length >= 3 && p.teamId === fplTeamId
          );
        }

        // Try compact match (strips dots, spaces, hyphens — "E. Le Fee" matches "E.Le Fee")
        if (!match && fplTeamId) {
          const compactPlayer = compact(apiPlayerName);
          match = playerIndex.find(p =>
            (p.compactWeb === compactPlayer || p.compactFull === compactPlayer ||
             compactPlayer.includes(p.compactWeb) || p.compactWeb.includes(compactPlayer)) &&
            p.compactWeb.length >= 3 && p.teamId === fplTeamId
          );
        }

        // Try last name without team (fallback)
        if (!match) {
          match = playerIndex.find(p =>
            p.secondName === playerLast || p.webName === playerLast
          );
        }

        // Try compact without team (last resort)
        if (!match) {
          const compactPlayer = compact(apiPlayerName);
          match = playerIndex.find(p =>
            p.compactWeb === compactPlayer && p.compactWeb.length >= 4
          );
        }

        const pos = match ? match.position : null;
        // Store in cache for future lookups
        playerPositionCache.set(cacheKey, pos);
        return pos;
      }

      for (const event of dedupedFeed) {
        if (event.type === 'Goal' && event.player) {
          // Determine which team scored based on isHome + homeTeam/awayTeam
          const scoringTeam = event.isHome ? event.homeTeam : event.awayTeam;
          const pos = findPlayerPosition(event.player, scoringTeam);

          if (pos === 1 || pos === 2) {
            event.goalPoints = 6;
          } else if (pos === 3) {
            event.goalPoints = 5;
          } else {
            event.goalPoints = 4; // FWD or unknown
          }
        }
      }
    }
  } catch {}

  return { feed: dedupedFeed.slice(0, 100), isLive, fixtureCount: fixtures.length };
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
