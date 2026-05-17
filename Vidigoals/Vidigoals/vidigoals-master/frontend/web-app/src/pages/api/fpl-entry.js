/**
 * API Route: /api/fpl-entry?id={managerId}
 * Fetches live FPL manager data including real-time GW points calculated from picks + live data
 */

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });

  try {
    // Fetch manager entry data
    const entryRes = await fetch(`https://fantasy.premierleague.com/api/entry/${id}/`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VidiGoals/1.0)' },
    });
    if (!entryRes.ok) return res.status(entryRes.status).json({ error: 'FPL API error' });
    const entry = await entryRes.json();

    const currentGW = entry.current_event;
    let liveGwPoints = entry.summary_event_points || 0;

    // If summary_event_points is 0 or seems stale, calculate from picks + live data
    if (currentGW) {
      try {
        // Fetch picks for current GW
        const picksRes = await fetch(`https://fantasy.premierleague.com/api/entry/${id}/event/${currentGW}/picks/`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VidiGoals/1.0)' },
        });

        if (picksRes.ok) {
          const picksData = await picksRes.json();

          // Fetch live points for this GW
          const liveRes = await fetch(`https://fantasy.premierleague.com/api/event/${currentGW}/live/`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VidiGoals/1.0)' },
          });

          if (liveRes.ok) {
            const liveData = await liveRes.json();
            const livePoints = {};
            if (liveData.elements) {
              for (const el of liveData.elements) {
                livePoints[el.id] = el.stats?.total_points ?? 0;
              }
            }

            // Calculate total GW points from starting XI (with multipliers)
            let calculatedPoints = 0;
            const picks = picksData.picks || [];
            for (const pick of picks) {
              if (pick.position <= 11) { // Starting XI only
                const pts = livePoints[pick.element] || 0;
                calculatedPoints += pts * (pick.multiplier || 1);
              }
            }

            // Subtract any hits
            const hits = picksData.entry_history?.event_transfers_cost || 0;
            calculatedPoints -= hits;

            // Use calculated if it's higher (more up-to-date during live)
            if (calculatedPoints > liveGwPoints) {
              liveGwPoints = calculatedPoints;
            }
          }
        }
      } catch {}
    }

    return res.status(200).json({
      summary_event_points: liveGwPoints,
      summary_overall_points: entry.summary_overall_points,
      summary_overall_rank: entry.summary_overall_rank,
      current_event: currentGW,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
