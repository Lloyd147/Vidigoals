/**
 * API Route: /api/fetch-odds
 *
 * Fetches goalscorer odds from The Odds API for all upcoming PL matches.
 * Stores the best odds per player in memory.
 * Call this hourly to keep odds fresh.
 *
 * GET: Triggers a fetch of all current PL goalscorer odds
 * Returns: { success, matchesProcessed, playersUpdated, remainingRequests }
 *
 * Uses markets: player_goal_scorer_anytime, player_first_goal_scorer
 * Sport: soccer_epl
 * Region: uk (falls back to us if uk unavailable)
 */

const ODDS_API_KEY = process.env.THE_ODDS_API_KEY;
const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
const SPORT = 'soccer_epl';

// In-memory odds store (shared with player-odds.js via import if needed)
// For now, store here and expose via GET
const oddsCache = { data: {}, lastFetched: null, remainingRequests: null };

// Only re-fetch if data is older than 3 days
const REFRESH_INTERVAL = 3 * 24 * 60 * 60 * 1000; // 3 days

async function fetchFromOddsApi(path) {
  const url = `${ODDS_API_BASE}${path}${path.includes('?') ? '&' : '?'}apiKey=${ODDS_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Odds API error ${res.status}: ${text}`);
  }
  // Track remaining requests from headers
  oddsCache.remainingRequests = res.headers.get('x-requests-remaining');
  return res.json();
}

function fractionalToDecimal(fraction) {
  if (!fraction) return null;
  if (typeof fraction === 'number') return fraction;
  const parts = String(fraction).split('/');
  if (parts.length === 2) {
    return (parseInt(parts[0]) / parseInt(parts[1]) + 1).toFixed(2);
  }
  return parseFloat(fraction) || null;
}

export default async function handler(req, res) {
  if (!ODDS_API_KEY) {
    return res.status(500).json({ error: 'ODDS_API_KEY not configured. Add it in Vercel Environment Variables.' });
  }

  if (req.method === 'GET' && req.query.action === 'status') {
    // Return current stored odds
    return res.status(200).json({
      odds: oddsCache.data,
      lastFetched: oddsCache.lastFetched,
      remainingRequests: oddsCache.remainingRequests,
      playerCount: Object.keys(oddsCache.data).length,
    });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' });
  }

  // If data is fresh enough, return cached without re-fetching
  if (oddsCache.lastFetched && Date.now() - new Date(oddsCache.lastFetched).getTime() < REFRESH_INTERVAL) {
    return res.status(200).json({
      success: true,
      cached: true,
      lastFetched: oddsCache.lastFetched,
      totalPlayersInCache: Object.keys(oddsCache.data).length,
      remainingRequests: oddsCache.remainingRequests,
      message: 'Data is fresh (less than 3 days old). Use ?force=true to override.',
    });
  }

  // Allow force refresh with ?force=true
  if (req.query.force !== 'true' && oddsCache.lastFetched) {
    // Already have data, just return it
  }

  try {
    // Step 1: Get all upcoming EPL events
    const events = await fetchFromOddsApi(`/sports/${SPORT}/events`);
    if (!events || events.length === 0) {
      return res.status(200).json({ success: true, message: 'No upcoming EPL events', matchesProcessed: 0 });
    }

    let playersUpdated = 0;
    let matchesProcessed = 0;

    // Step 2: For each event, fetch goalscorer odds
    const upcomingEvents = events;

    for (const event of upcomingEvents) {
      try {
        // Fetch anytime goalscorer odds
        const anytimeOdds = await fetchFromOddsApi(
          `/sports/${SPORT}/events/${event.id}/odds?regions=uk,eu&markets=player_goal_scorer_anytime&oddsFormat=decimal`
        );

        if (anytimeOdds?.bookmakers) {
          for (const bookmaker of anytimeOdds.bookmakers) {
            for (const market of bookmaker.markets || []) {
              for (const outcome of market.outcomes || []) {
                const playerName = outcome.description || outcome.name;
                if (!playerName || outcome.name === 'No') continue; // Skip "No" outcomes

                const key = playerName.toLowerCase().trim();
                if (!oddsCache.data[key]) {
                  oddsCache.data[key] = { name: playerName, fixture: `${event.home_team} v ${event.away_team}` };
                }

                const odds = outcome.price;
                const bookie = bookmaker.title;

                // Store best (highest) odds for anytime
                if (!oddsCache.data[key].anytime || odds > parseFloat(oddsCache.data[key].anytime.odds)) {
                  oddsCache.data[key].anytime = { odds: odds.toFixed(2), bookie };
                }

                playersUpdated++;
              }
            }
          }
        }

        // Fetch first goalscorer odds
        try {
          const firstOdds = await fetchFromOddsApi(
            `/sports/${SPORT}/events/${event.id}/odds?regions=uk,eu&markets=player_first_goal_scorer&oddsFormat=decimal`
          );

          if (firstOdds?.bookmakers) {
            for (const bookmaker of firstOdds.bookmakers) {
              for (const market of bookmaker.markets || []) {
                for (const outcome of market.outcomes || []) {
                  const playerName = outcome.description || outcome.name;
                  if (!playerName || outcome.name === 'No') continue;

                  const key = playerName.toLowerCase().trim();
                  if (!oddsCache.data[key]) {
                    oddsCache.data[key] = { name: playerName, fixture: `${event.home_team} v ${event.away_team}` };
                  }

                  const odds = outcome.price;
                  const bookie = bookmaker.title;

                  if (!oddsCache.data[key].firstGoal || odds > parseFloat(oddsCache.data[key].firstGoal.odds)) {
                    oddsCache.data[key].firstGoal = { odds: odds.toFixed(2), bookie };
                  }

                  playersUpdated++;
                }
              }
            }
          }
        } catch {}

        matchesProcessed++;
      } catch (err) {
        console.warn(`Failed to fetch odds for ${event.home_team} v ${event.away_team}:`, err.message);
      }
    }

    oddsCache.lastFetched = new Date().toISOString();

    return res.status(200).json({
      success: true,
      matchesProcessed,
      playersUpdated,
      totalPlayersInCache: Object.keys(oddsCache.data).length,
      remainingRequests: oddsCache.remainingRequests,
      lastFetched: oddsCache.lastFetched,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
