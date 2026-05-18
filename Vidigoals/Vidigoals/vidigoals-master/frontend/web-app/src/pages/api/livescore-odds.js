/**
 * API Route: /api/livescore-odds
 *
 * Scrapes player odds from Livescorebet UK's internal API.
 * GET: Returns stored odds or fetches fresh if stale
 * GET ?refresh=true: Forces a fresh fetch
 *
 * Endpoints used:
 * - League: https://gateway-uk.livescorebet.com/sportsbook/gateway/v3/view/events/matches?categoryid=SBTC3_40253&interval=ALL&lang=en-gb
 * - Event: https://gateway-uk.livescorebet.com/sportsbook/gateway/v1/view/event?eventid={id}&lang=en-gb
 */

const LEAGUE_URL = 'https://gateway-uk.livescorebet.com/sportsbook/gateway/v3/view/events/matches?categoryid=SBTC3_40253&interval=ALL&lang=en-gb';
const EVENT_URL = 'https://gateway-uk.livescorebet.com/sportsbook/gateway/v1/view/event';
const HEADERS = {
  'Referer': 'https://www.livescorebet.com/uk/',
  'Origin': 'https://www.livescorebet.com',
};

// In-memory odds store
let oddsStore = { data: {}, lastFetched: null, matches: [] };
const CACHE_TTL = 3 * 60 * 60 * 1000; // 3 hours

async function fetchJson(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchAllOdds() {
  // Step 1: Get all EPL matches
  const leagueData = await fetchJson(LEAGUE_URL);
  const categories = leagueData.events?.categories || [];
  const events = [];
  for (const cat of categories) {
    for (const ev of (cat.events || [])) {
      if (ev.state === 'NOTSTARTED' || ev.state === 'INPLAY') {
        events.push({
          id: ev.id,
          home: ev.participants?.find(p => p.venueRole === 'Home')?.name || '',
          away: ev.participants?.find(p => p.venueRole === 'Away')?.name || '',
          startTime: ev.startTime,
        });
      }
    }
  }

  // Step 2: For each match, fetch detailed markets (limit to 5 to stay within timeout)
  const allOdds = {};
  const matchesProcessed = [];

  for (const event of events.slice(0, 5)) {
    try {
      const eventData = await fetchJson(`${EVENT_URL}?eventid=${event.id}&lang=en-gb`);
      const markets = eventData.event?.markets || eventData.markets || [];

      // Extract goalscorer (anytime)
      const goalscorer = markets.find(m => m.name === 'Goalscorer');
      if (goalscorer) {
        for (const sel of (goalscorer.selections || [])) {
          const playerName = sel.name?.replace('Anytime: ', '').replace('First: ', '') || '';
          const type = sel.outcomeType || '';
          if (!playerName) continue;

          const key = playerName.toLowerCase();
          if (!allOdds[key]) {
            allOdds[key] = { name: playerName, fixture: `${event.home} v ${event.away}` };
          }

          if (type === 'TO_SCORE_ANYTIME' || sel.name?.startsWith('Anytime:')) {
            allOdds[key].anytime = { odds: sel.odds?.toFixed(2), bookie: 'LivescoreBet' };
          }
          if (type === 'TO_SCORE_FIRST' || sel.name?.startsWith('First:')) {
            allOdds[key].firstGoal = { odds: sel.odds?.toFixed(2), bookie: 'LivescoreBet' };
          }
        }
      }

      // Extract 2+ goals
      const twoPlus = markets.find(m => m.name === 'To score at least 2 goals');
      if (twoPlus) {
        for (const sel of (twoPlus.selections || [])) {
          const playerName = sel.name?.replace(' - Yes', '') || '';
          const key = playerName.toLowerCase();
          if (allOdds[key]) {
            allOdds[key].twoPlus = { odds: sel.odds?.toFixed(2), bookie: 'LivescoreBet' };
          }
        }
      }

      // Extract hat-trick
      const hatTrick = markets.find(m => m.name === 'To score at least 3 goals');
      if (hatTrick) {
        for (const sel of (hatTrick.selections || [])) {
          const playerName = sel.name?.replace(' - Yes', '') || '';
          const key = playerName.toLowerCase();
          if (allOdds[key]) {
            allOdds[key].hatTrick = { odds: sel.odds?.toFixed(2), bookie: 'LivescoreBet' };
          }
        }
      }

      // Extract assists
      const assists = markets.find(m => m.name === 'To give an assist');
      if (assists) {
        for (const sel of (assists.selections || [])) {
          const playerName = sel.name?.replace(' - Yes', '') || '';
          const key = playerName.toLowerCase();
          if (!allOdds[key]) {
            allOdds[key] = { name: playerName, fixture: `${event.home} v ${event.away}` };
          }
          allOdds[key].assists = { odds: sel.odds?.toFixed(2), bookie: 'LivescoreBet' };
        }
      }

      // Extract cards
      const cards = markets.find(m => m.name === 'To Get a Card');
      if (cards) {
        for (const sel of (cards.selections || [])) {
          const playerName = sel.name?.replace(' - Yes', '') || '';
          const key = playerName.toLowerCase();
          if (!allOdds[key]) {
            allOdds[key] = { name: playerName, fixture: `${event.home} v ${event.away}` };
          }
          allOdds[key].yellowCard = { odds: sel.odds?.toFixed(2), bookie: 'LivescoreBet' };
        }
      }

      matchesProcessed.push(`${event.home} v ${event.away}`);
    } catch (err) {
      console.warn(`Failed to fetch ${event.home} v ${event.away}:`, err.message);
    }
  }

  return { odds: allOdds, matches: matchesProcessed };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const forceRefresh = req.query.refresh === 'true';

  // Return cached if fresh enough
  if (!forceRefresh && oddsStore.lastFetched && Date.now() - new Date(oddsStore.lastFetched).getTime() < CACHE_TTL) {
    return res.status(200).json({
      odds: oddsStore.data,
      lastFetched: oddsStore.lastFetched,
      matches: oddsStore.matches,
      cached: true,
      playerCount: Object.keys(oddsStore.data).length,
    });
  }

  try {
    const { odds, matches } = await fetchAllOdds();
    oddsStore = { data: odds, lastFetched: new Date().toISOString(), matches };

    return res.status(200).json({
      odds,
      lastFetched: oddsStore.lastFetched,
      matches,
      cached: false,
      playerCount: Object.keys(odds).length,
    });
  } catch (err) {
    // Return stale data if available
    if (oddsStore.data && Object.keys(oddsStore.data).length > 0) {
      return res.status(200).json({
        odds: oddsStore.data,
        lastFetched: oddsStore.lastFetched,
        matches: oddsStore.matches,
        cached: true,
        stale: true,
        error: err.message,
      });
    }
    return res.status(500).json({ error: err.message });
  }
}
