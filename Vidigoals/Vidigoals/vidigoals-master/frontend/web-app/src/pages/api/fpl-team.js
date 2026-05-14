/**
 * API Route: /api/fpl-team?id={managerId}
 *
 * Fetches a manager's FPL team data using their public Manager ID.
 * Uses the official FPL API — no authentication required, public data only.
 */

// Cache manager lookups for 5 minutes to avoid hammering FPL
const teamCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id || isNaN(id) || Number(id) < 1) {
    return res.status(400).json({ error: 'Invalid Manager ID' });
  }

  // Check cache
  const cached = teamCache.get(id);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return res.status(200).json(cached.data);
  }

  try {
    const fplRes = await fetch(`https://fantasy.premierleague.com/api/entry/${id}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VidiGoals/1.0)',
      },
    });

    if (fplRes.status === 404) {
      return res.status(404).json({ error: 'Manager ID not found. Please check your FPL Manager ID.' });
    }

    if (!fplRes.ok) {
      throw new Error(`FPL API error: ${fplRes.status}`);
    }

    const data = await fplRes.json();

    // Store in cache
    teamCache.set(id, { data, fetchedAt: Date.now() });

    return res.status(200).json(data);
  } catch (err) {
    console.error('FPL team lookup error:', err.message);
    return res.status(500).json({ error: 'Could not fetch team data. Please try again.' });
  }
}
