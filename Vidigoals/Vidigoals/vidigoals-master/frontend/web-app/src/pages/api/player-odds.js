/**
 * API Route: /api/player-odds?gw={gameweek}
 *
 * Returns stored betting odds for players in the current gameweek.
 * Odds are scraped hourly from betting sites and stored in memory.
 *
 * Response format:
 * {
 *   [playerId]: {
 *     firstGoal: { odds: "7.00", bookie: "bet365" },
 *     anytime: { odds: "3.50", bookie: "bet365" },
 *     twoPlus: { odds: "12.00", bookie: "betfair" },
 *     hatTrick: { odds: "51.00", bookie: "skybet" },
 *   }
 * }
 *
 * To add odds data, POST to /api/player-odds with:
 * { playerId, market, odds, bookie }
 * where market is one of: firstGoal, anytime, twoPlus, hatTrick
 */

// In-memory odds store (persists across requests on same instance)
// In production, replace with a database (Vercel KV, Supabase, etc.)
const oddsStore = new Map(); // key: `${gw}-${playerId}` → { firstGoal, anytime, twoPlus, hatTrick }
let lastUpdated = null;

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { gw } = req.query;
    if (!gw) return res.status(400).json({ error: 'gw required' });

    // Return all odds for this gameweek
    const result = {};
    for (const [key, value] of oddsStore.entries()) {
      if (key.startsWith(`${gw}-`)) {
        const playerId = key.split('-')[1];
        result[playerId] = value;
      }
    }

    return res.status(200).json({ odds: result, lastUpdated });
  }

  if (req.method === 'POST') {
    // Bulk update odds
    // Body: { gw, odds: [{ playerId, playerName, market, odds, bookie }] }
    const { gw, odds } = req.body || {};
    if (!gw || !odds || !Array.isArray(odds)) {
      return res.status(400).json({ error: 'gw and odds array required' });
    }

    for (const entry of odds) {
      const { playerId, market, odds: oddsValue, bookie } = entry;
      if (!playerId || !market) continue;

      const key = `${gw}-${playerId}`;
      const existing = oddsStore.get(key) || {};

      // Only update if new odds are better (higher for goalscorer markets)
      const currentOdds = existing[market]?.odds ? parseFloat(existing[market].odds) : 0;
      const newOdds = parseFloat(oddsValue) || 0;

      if (newOdds > currentOdds || !existing[market]) {
        existing[market] = { odds: oddsValue, bookie };
        oddsStore.set(key, existing);
      }
    }

    lastUpdated = new Date().toISOString();
    return res.status(200).json({ success: true, count: odds.length, lastUpdated });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
