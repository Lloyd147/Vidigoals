/**
 * API Route: /api/fpl-entry?id={managerId}
 * Fetches live FPL manager data (current GW points, overall points, rank)
 */

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });

  try {
    const response = await fetch(`https://fantasy.premierleague.com/api/entry/${id}/`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VidiGoals/1.0)' },
    });
    if (!response.ok) return res.status(response.status).json({ error: 'FPL API error' });

    const data = await response.json();
    return res.status(200).json({
      summary_event_points: data.summary_event_points,
      summary_overall_points: data.summary_overall_points,
      summary_overall_rank: data.summary_overall_rank,
      current_event: data.current_event,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
