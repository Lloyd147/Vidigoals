/**
 * API Route: /api/livescore-odds
 *
 * Scrapes player odds from Livescorebet's internal API.
 * Supports multiple countries — detects user's country via Vercel geo header.
 *
 * GET: Returns stored odds for user's country (or fetches fresh if stale)
 * GET ?refresh=true: Forces a fresh fetch
 * GET ?country=ng: Override country (for testing)
 *
 * Supported countries:
 * - UK (default): gateway-uk.livescorebet.com, lang=en-gb
 * - NG (Nigeria): gateway-ng.livescorebet.com, lang=en-ng
 * - More can be added by extending COUNTRY_CONFIG
 */

// ── Country Configuration ─────────────────────────────────────────────────────
const COUNTRY_CONFIG = {
  gb: {
    gateway: 'gateway-uk.livescorebet.com',
    lang: 'en-gb',
    sitePath: '/uk/',
    referer: 'https://www.livescorebet.com/uk/',
    leagueEndpoint: '/sportsbook/gateway/v3/view/events/matches?categoryid=SBTC3_40253&interval=ALL',
    eventEndpoint: '/sportsbook/gateway/v1/view/event',
  },
  ng: {
    gateway: 'gateway-ng.livescorebet.com',
    lang: 'en-ng',
    sitePath: '/ng/',
    referer: 'https://www.livescorebet.com/ng/',
    leagueEndpoint: '/sportsbook/gateway/v3/view/events/matches?categoryid=SBTC3_40253&interval=ALL',
    eventEndpoint: '/sportsbook/gateway/v1/view/event',
  },
};

const DEFAULT_COUNTRY = 'gb';

// ── In-memory odds store (per country) ────────────────────────────────────────
const oddsStores = {}; // { gb: { data, lastFetched, matches }, ng: { ... } }
const CACHE_TTL = 3 * 60 * 60 * 1000; // 3 hours

function getStore(country) {
  if (!oddsStores[country]) {
    oddsStores[country] = { data: {}, lastFetched: null, matches: [] };
  }
  return oddsStores[country];
}

async function fetchJson(url, headers) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchAllOdds(country) {
  const config = COUNTRY_CONFIG[country] || COUNTRY_CONFIG[DEFAULT_COUNTRY];
  const baseUrl = `https://${config.gateway}`;
  const headers = {
    'Referer': config.referer,
    'Origin': 'https://www.livescorebet.com',
  };

  // Step 1: Get all EPL matches
  const leagueUrl = `${baseUrl}${config.leagueEndpoint}&lang=${config.lang}`;
  let events = [];

  try {
    const leagueData = await fetchJson(leagueUrl, headers);
    const categories = leagueData.events?.categories || [];
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
  } catch (err) {
    // If v3 events/matches fails (Nigeria might not support it), try coupon endpoint
    try {
      const couponUrl = `${baseUrl}/sportsbook/gateway/v2/view/coupon?id=3103&interval=ALL&lang=${config.lang}`;
      const couponData = await fetchJson(couponUrl, headers);
      const couponEvents = couponData.events || couponData.coupon?.events || [];
      for (const ev of couponEvents) {
        if (ev.state === 'NOTSTARTED' || ev.state === 'INPLAY') {
          events.push({
            id: ev.id,
            home: ev.participants?.find(p => p.venueRole === 'Home')?.name || '',
            away: ev.participants?.find(p => p.venueRole === 'Away')?.name || '',
            startTime: ev.startTime,
          });
        }
      }
    } catch (err2) {
      throw new Error(`Could not fetch matches for ${country}: ${err.message} / ${err2.message}`);
    }
  }

  // Step 2: For each match, fetch detailed markets
  const allOdds = {};
  const matchesProcessed = [];

  function buildEventUrl(home, away, eventId) {
    const slug = `${home}-${away}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return `https://www.livescorebet.com${config.sitePath}sports/football/england-premier-league/${slug}/${eventId}/?marketGroupId=213`;
  }

  for (const event of events) {
    try {
      const eventUrl = `${baseUrl}${config.eventEndpoint}?eventid=${event.id}&lang=${config.lang}`;
      const eventData = await fetchJson(eventUrl, headers);
      const markets = eventData.event?.markets || eventData.markets || [];
      const deepLink = buildEventUrl(event.home, event.away, event.id);

      // Extract goalscorer (anytime)
      const goalscorer = markets.find(m => m.name === 'Goalscorer');
      if (goalscorer) {
        for (const sel of (goalscorer.selections || [])) {
          const playerName = sel.name?.replace('Anytime: ', '').replace('First: ', '') || '';
          const type = sel.outcomeType || '';
          if (!playerName) continue;

          const key = playerName.toLowerCase();
          if (!allOdds[key]) {
            allOdds[key] = { name: playerName, fixture: `${event.home} v ${event.away}`, eventUrl: deepLink, selectionId: sel.id || null };
          }

          if (type === 'TO_SCORE_ANYTIME' || sel.name?.startsWith('Anytime:')) {
            allOdds[key].anytime = { odds: sel.odds?.toFixed(2), bookie: 'LivescoreBet', selectionId: sel.id || null };
          }
          if (type === 'TO_SCORE_FIRST' || sel.name?.startsWith('First:')) {
            allOdds[key].firstGoal = { odds: sel.odds?.toFixed(2), bookie: 'LivescoreBet', selectionId: sel.id || null };
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
            allOdds[key].twoPlus = { odds: sel.odds?.toFixed(2), bookie: 'LivescoreBet', selectionId: sel.id || null };
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
            allOdds[key].hatTrick = { odds: sel.odds?.toFixed(2), bookie: 'LivescoreBet', selectionId: sel.id || null };
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
            allOdds[key] = { name: playerName, fixture: `${event.home} v ${event.away}`, eventUrl: deepLink, selectionId: sel.id || null };
          }
          allOdds[key].assists = { odds: sel.odds?.toFixed(2), bookie: 'LivescoreBet', selectionId: sel.id || null };
        }
      }

      // Extract cards
      const cards = markets.find(m => m.name === 'To Get a Card');
      if (cards) {
        for (const sel of (cards.selections || [])) {
          const playerName = sel.name?.replace(' - Yes', '') || '';
          const key = playerName.toLowerCase();
          if (!allOdds[key]) {
            allOdds[key] = { name: playerName, fixture: `${event.home} v ${event.away}`, eventUrl: deepLink, selectionId: sel.id || null };
          }
          allOdds[key].yellowCard = { odds: sel.odds?.toFixed(2), bookie: 'LivescoreBet', selectionId: sel.id || null };
        }
      }

      matchesProcessed.push(`${event.home} v ${event.away}`);
    } catch (err) {
      console.warn(`[${country}] Failed to fetch ${event.home} v ${event.away}:`, err.message);
    }
  }

  return { odds: allOdds, matches: matchesProcessed };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  // Detect country: query param override > Vercel geo header > default UK
  const queryCountry = (req.query.country || '').toLowerCase();
  const vercelCountry = (req.headers['x-vercel-ip-country'] || '').toLowerCase();
  const detectedCountry = queryCountry || vercelCountry || DEFAULT_COUNTRY;

  // Map to supported country (fall back to UK if unsupported)
  const country = COUNTRY_CONFIG[detectedCountry] ? detectedCountry : DEFAULT_COUNTRY;

  const forceRefresh = req.query.refresh === 'true';
  const store = getStore(country);

  // Return cached if fresh enough
  if (!forceRefresh && store.lastFetched && Date.now() - new Date(store.lastFetched).getTime() < CACHE_TTL) {
    return res.status(200).json({
      odds: store.data,
      lastFetched: store.lastFetched,
      matches: store.matches,
      cached: true,
      country,
      playerCount: Object.keys(store.data).length,
    });
  }

  try {
    const { odds, matches } = await fetchAllOdds(country);
    oddsStores[country] = { data: odds, lastFetched: new Date().toISOString(), matches };

    return res.status(200).json({
      odds,
      lastFetched: oddsStores[country].lastFetched,
      matches,
      cached: false,
      country,
      playerCount: Object.keys(odds).length,
    });
  } catch (err) {
    // Return stale data if available
    if (store.data && Object.keys(store.data).length > 0) {
      return res.status(200).json({
        odds: store.data,
        lastFetched: store.lastFetched,
        matches: store.matches,
        cached: true,
        stale: true,
        country,
        error: err.message,
      });
    }
    return res.status(500).json({ error: err.message, country });
  }
}
